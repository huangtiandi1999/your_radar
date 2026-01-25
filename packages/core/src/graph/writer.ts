import z from 'zod';
import { deepseek_llm } from '@/model/deepseek';
import { StateGraph, START, END, Annotation, MemorySaver } from '@langchain/langgraph';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { spinner } from '@clack/prompts';

/**
 * Writer Agent 状态定义
 * 基于 Reflection 范式：生成 -> 反思 -> 改进
 */
const WriterState = Annotation.Root({
  // 输入
  researchReport: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
  originalRequirement: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
  
  // 生成阶段
  initialDraft: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
  
  // 反思阶段
  reflection: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
  needsImprovement: Annotation<boolean>({
    reducer: (x, y) => y ?? x ?? false,
  }),
  
  // 改进阶段
  improvedDraft: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
  
  // 最终输出
  finalPlan: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
  
  // 迭代控制
  iteration: Annotation<number>({
    reducer: (x, y) => y ?? x ?? 0,
  }),
  maxIterations: Annotation<number>({
    reducer: (x, y) => y ?? x ?? 3,
  }),
});

type WriterStateType = typeof WriterState.State;

/**
 * 节点1: 生成初始营销方案
 * 基于研究报告生成第一版营销方案
 */
async function generateInitialDraft(state: WriterStateType): Promise<Partial<WriterStateType>> {
  const currentIteration = state.iteration ?? 0;
  console.log(`[Writer] 生成初始营销方案 (迭代 ${currentIteration})`);
  
  const systemPrompt = `你是一位资深的营销策划专家，擅长将市场研究报告转化为可执行的营销方案。

你的任务是根据研究报告，生成一份完整的营销方案。方案应该包括：
1. 目标用户画像
2. 核心营销策略
3. 内容策略（包括平台特色）
4. 执行计划
5. 预期效果

要求：
- 方案要具体、可执行
- 结合研究报告中的数据和洞察
- 针对目标平台（如小红书、抖音等）的特点
- 使用 Markdown 格式，结构清晰`;

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['human', `原始需求：\n{requirement}\n\n研究报告：\n{researchReport}\n\n请基于以上信息生成营销方案：`],
  ]);

  const spin = spinner();
  
  try {
    spin.start('正在生成初始营销方案...');
    
    const chain = prompt.pipe(deepseek_llm);
    const response = await chain.invoke({
      requirement: state.originalRequirement,
      researchReport: state.researchReport,
    });
    
    const draft = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);
    
    spin.stop(`初始方案生成完成 (${draft.length} 字符)`);
    return { 
      initialDraft: draft,
      // 生成初始方案不增加迭代次数，迭代次数在反思评估完成后才增加
    };
  } catch (error) {
    spin.stop('生成初始方案失败 ❌');
    console.error('[Writer] 生成初始方案失败:', error);
    throw error;
  }
}

/**
 * 节点2: 反思和评估
 * 评估当前方案的质量，判断是否需要改进
 */
async function reflectOnDraft(state: WriterStateType): Promise<Partial<WriterStateType>> {
  const currentIteration = state.iteration ?? 0;
  console.log(`[Writer] 反思和评估方案 (迭代 ${currentIteration})`);
  
  const draftToEvaluate = state.improvedDraft || state.initialDraft;
  
  const reflectionSchema = z.object({
    reflection: z.string().describe('对当前方案的反思，指出优点和不足'),
    needsImprovement: z.boolean().describe('是否需要进一步改进'),
    improvementSuggestions: z.array(z.string()).optional().describe('具体的改进建议'),
  });

  const systemPrompt = `你是一位严格的营销方案评审专家。请仔细评估以下营销方案的质量。

评估维度：
1. 是否充分运用了研究报告中的数据和洞察
2. 策略是否具体、可执行
3. 是否针对目标平台的特点
4. 逻辑是否清晰、完整
5. 是否满足原始需求

请给出客观、专业的评估，并判断是否需要改进。`;

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['human', `原始需求：\n{requirement}\n\n研究报告：\n{researchReport}\n\n当前方案：\n{draft}\n\n请评估这个方案：`],
  ]);

  const spin = spinner();
  
  try {
    spin.start('正在反思和评估方案...');
    
    const structuredModel = deepseek_llm.withStructuredOutput(reflectionSchema);
    
    const chain = prompt.pipe(structuredModel);
    const result = await chain.invoke({
      requirement: state.originalRequirement,
      researchReport: state.researchReport,
      draft: draftToEvaluate,
    });
    
    spin.stop('反思评估完成');
    
    console.log(`[Writer] 反思完成，需要改进: ${result.needsImprovement}`);
    if (result.improvementSuggestions && result.improvementSuggestions.length > 0) {
      console.log(`[Writer] 改进建议: ${result.improvementSuggestions.join('; ')}`);
    }
    
    return {
      reflection: result.reflection,
      needsImprovement: result.needsImprovement && currentIteration < state.maxIterations,
      iteration: currentIteration + 1,
    };
  } catch (error) {
    spin.stop('反思评估失败 ❌');
    console.error('[Writer] 反思评估失败:', error);
    // 如果反思失败，默认不需要改进，但仍然增加迭代次数
    return {
      reflection: '反思过程出现错误，无法评估',
      needsImprovement: false,
      iteration: currentIteration + 1, // 即使失败也增加迭代次数
    };
  }
}

/**
 * 节点3: 改进方案
 * 根据反思结果改进营销方案
 */
async function improveDraft(state: WriterStateType): Promise<Partial<WriterStateType>> {
  const currentIteration = state.iteration ?? 0;
  console.log(`[Writer] 改进营销方案 (迭代 ${currentIteration})`);
  
  const currentDraft = state.improvedDraft || state.initialDraft;
  
  const systemPrompt = `你是一位资深的营销策划专家。请根据反思意见改进营销方案。

改进要求：
1. 保留方案中的优点
2. 根据反思意见进行针对性改进
3. 确保改进后的方案更加完善
4. 保持 Markdown 格式和清晰的结构`;

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['human', `原始需求：\n{requirement}\n\n研究报告：\n{researchReport}\n\n当前方案：\n{currentDraft}\n\n反思意见：\n{reflection}\n\n请改进这个方案：`],
  ]);

  const spin = spinner();
  
  try {
    spin.start('正在改进营销方案...');
    
    const chain = prompt.pipe(deepseek_llm);
    const response = await chain.invoke({
      requirement: state.originalRequirement,
      researchReport: state.researchReport,
      currentDraft: currentDraft,
      reflection: state.reflection,
    });
    
    const improved = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);
    
    spin.stop(`方案改进完成 (${improved.length} 字符)`);
    return { 
      improvedDraft: improved,
      // 改进方案不增加迭代次数，迭代次数在反思评估完成后才增加
    };
  } catch (error) {
    spin.stop('改进方案失败 ❌');
    console.error('[Writer] 改进方案失败:', error);
    // 如果改进失败，返回当前方案
    return { 
      improvedDraft: currentDraft,
      // 改进方案不增加迭代次数，迭代次数在反思评估完成后才增加
    };
  }
}

/**
 * 节点4: 生成最终方案
 * 确定最终输出
 */
function finalizePlan(state: WriterStateType): Partial<WriterStateType> {
  console.log(`[Writer] 生成最终营销方案`);
  
  const finalPlan = state.improvedDraft || state.initialDraft;
  
  return { finalPlan };
}

/**
 * 条件边：判断是否需要继续改进
 */
function shouldContinueImproving(state: WriterStateType): string {
  const currentIteration = state.iteration ?? 0;
  const maxIterations = state.maxIterations ?? 3;
  
  if (state.needsImprovement && currentIteration < maxIterations) {
    console.log(`[Writer] 需要继续改进 (当前迭代: ${currentIteration}, 最大迭代: ${maxIterations})`);
    return 'improve';
  }
  console.log(`[Writer] 达到最大迭代次数或不需要改进，进入最终化阶段 (当前迭代: ${currentIteration})`);
  return 'finalize';
}

// 构建 Reflection 工作流图
const writerWorkflow = new StateGraph(WriterState)
  .addNode('generate_initial', generateInitialDraft)
  .addNode('reflect', reflectOnDraft)
  .addNode('improve', improveDraft)
  .addNode('finalize', finalizePlan)
  .addEdge(START, 'generate_initial')
  .addEdge('generate_initial', 'reflect')
  .addConditionalEdges('reflect', shouldContinueImproving, {
    improve: 'improve',
    finalize: 'finalize',
  })
  .addEdge('improve', 'reflect') // 改进后重新反思
  .addEdge('finalize', END);

// 创建 checkpoint 用于状态持久化
// 支持任务恢复、调试和监控
const checkpointer = new MemorySaver();

// 编译工作流，添加 checkpoint
export const writerAgent = writerWorkflow.compile({
  checkpointer,
});

/**
 * 执行 Writer Agent 任务
 * @param researchReport - 来自 Research Agent 的研究报告
 * @param originalRequirement - 原始营销需求
 * @param maxIterations - 最大迭代次数，默认3次
 * @param threadId - 可选的线程ID，用于状态持久化和恢复。如果不提供，将自动生成
 * @returns 最终营销方案
 */
export async function runWriterAgent(
  researchReport: string,
  originalRequirement: string,
  maxIterations: number = 3,
  threadId?: string
): Promise<string> {
  console.log(`[Writer] 开始执行 Writer Agent 任务`);
  console.log(`[Writer] 研究报告长度: ${researchReport.length} 字符`);
  console.log(`[Writer] 最大迭代次数: ${maxIterations}`);
  
  // 如果没有提供 threadId，生成一个唯一的 ID
  const finalThreadId = threadId || `writer-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  console.log(`[Writer] 线程ID: ${finalThreadId}`);
  
  try {
    const result = await writerAgent.invoke(
      {
        researchReport,
        originalRequirement,
        iteration: 0,
        maxIterations,
        needsImprovement: false,
      },
      {
        configurable: {
          thread_id: finalThreadId,
        },
      }
    );
    
    const finalPlan = result.finalPlan || result.improvedDraft || result.initialDraft || '未能生成营销方案';
    
    console.log(`[Writer] 任务完成，最终方案长度: ${finalPlan.length} 字符`);
    console.log(`[Writer] 总迭代次数: ${result.iteration}`);
    
    return finalPlan;
  } catch (error) {
    console.error('[Writer] 执行失败:', error);
    throw error;
  }
}
