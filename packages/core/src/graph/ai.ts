import { StateGraph, START, END, Annotation, MemorySaver } from '@langchain/langgraph';
import { planner, PlannerOutputType } from '@/model/claude';
import { runDeepResearch } from '@/graph/research';
import { runWriterAgent } from '@/graph/writer';
import { spinner, note, text, cancel, isCancel } from '@clack/prompts';
// import z from 'zod';

/**
 * 任务类型定义
 */
type Task = {
  id: number;
  taskName: string;
  description: string;
  agentType: 'researcher' | 'writer' | 'designer';
};

const maxClarifications = 2;

/**
 * Agent 工作流状态定义
 */
const AgentState = Annotation.Root({
  // 输入
  userInput: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
  
  // Planner 输出
  plan: Annotation<Array<Task>>({
    reducer: (x, y) => y ?? x ?? [],
  }),
  planningResult: Annotation<PlannerOutputType>({
    reducer: (x, y) => y ?? x,
  }),
  needMoreInfo: Annotation<boolean>({
    reducer: (x, y) => y ?? x ?? false,
  }),
  clarificationQuestions: Annotation<Array<string>>({
    reducer: (x, y) => y ?? x ?? [],
  }),
  userClarifications: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
  clarificationCount: Annotation<number>({
    reducer: (x, y) => y ?? x ?? 0,
  }),
  
  // 任务执行追踪
  currentTaskIndex: Annotation<number>({
    reducer: (x, y) => y ?? x ?? -1,
  }),
  nextTask: Annotation<Task | undefined>({
    reducer: (x, y) => y ?? x,
  }),
  
  // Research 相关（用于聚合多个 research 任务的结果）
  researchReports: Annotation<Record<number, string>>({
    reducer: (x, y) => {
      if (!y) return x ?? {};
      return { ...(x ?? {}), ...y };
    },
  }),
  aggregatedResearchReport: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
  
  // Writer 相关
  finalPlan: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
  
  // 控制流
  currentStep: Annotation<string>({
    reducer: (x, y) => y ?? x ?? 'planning',
  }),
  error: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
});

type AgentStateType = typeof AgentState.State;

/**
 * 节点1: 规划阶段
 * 调用 Planner 生成任务计划
 */
async function planning(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const spin = spinner();
  spin.start('正在生成营销计划...');
  
  try {
    // 合并原始输入和用户补充的信息
    const inputWithClarifications = state.userClarifications
      ? `${state.userInput}\n\n用户补充信息：\n${state.userClarifications}`
      : state.userInput;
    
    const result: PlannerOutputType = await planner.invoke({
      input: inputWithClarifications,
    });
    
    // 检查是否需要更多信息
    if (result.needMoreInfo) {
      const currentCount = state.clarificationCount ?? 0;
      
      // 如果已经达到最大次数，不再询问，直接使用已有信息继续
      if (currentCount >= maxClarifications) {
        spin.stop('已达到最大补充信息次数，将使用已有信息继续');
        note(`已补充 ${currentCount} 次信息，将基于现有信息生成计划`, '⚠️');
        
        // 即使 planner 说需要更多信息，也强制继续
        // 使用已有信息重新规划，但不设置 needMoreInfo
        if (!result.plan || result.plan.length === 0) {
          // 如果还是没有计划，返回错误
          return {
            error: '信息不足，无法生成有效的营销计划',
            currentStep: 'error',
          };
        }
        // 如果有计划，继续执行（会在下面处理）
      } else {
        // 未达到最大次数，继续询问
        spin.stop('需要更多信息');
        
        if (result.clarificationQuestions && result.clarificationQuestions.length > 0) {
          // 显示问题
          const questionsText = result.clarificationQuestions
            .map((q, index) => `${index + 1}. ${q}`)
            .join('\n');
          
          note(questionsText, `❓ 需要补充以下信息 (${currentCount + 1}/${maxClarifications})`);
          
          // 获取用户输入
          const clarification = await text({
            message: '请补充上述信息',
            placeholder: '请输入您的补充信息...',
            validate: (value) => {
              if (!value || value.trim().length === 0) {
                return '输入不能为空';
              }
              return undefined;
            },
          });
          
          if (isCancel(clarification)) {
            cancel('操作已取消');
            return {
              error: '用户取消了操作',
              currentStep: 'error',
            };
          }
          
          // 保存用户补充的信息，并重新规划
          // 将新的补充信息追加到已有的补充信息中
          const updatedClarifications = state.userClarifications
            ? `${state.userClarifications}\n\n${clarification.trim()}`
            : clarification.trim();
          
          return {
            planningResult: result,
            needMoreInfo: true,
            clarificationQuestions: result.clarificationQuestions,
            userClarifications: updatedClarifications,
            clarificationCount: currentCount + 1, // 增加计数
            currentStep: 'planning', // 重新规划
          };
        } else {
          // 如果没有提供问题，直接返回错误
          spin.stop('需要更多信息，但未提供具体问题 ❌');
          return {
            error: '需要更多信息，但未提供具体问题',
            currentStep: 'error',
          };
        }
      }
    }
    
    // 如果不需要更多信息，但 plan 为空或不存在
    if (!result.plan || result.plan.length === 0) {
      spin.stop('生成计划失败 ❌');
      return {
        error: '未能生成有效的营销计划',
        currentStep: 'error',
      };
    }
    
    // 成功生成计划，重置 needMoreInfo
    spin.stop('计划生成完成');
    
    const allResearchTasks = result.plan.filter((task: Task) => task.agentType === 'researcher');
    if (allResearchTasks.length > 2) {
      // console.log(`[Agent] 警告: 计划中包含 ${allResearchTasks.length} 个研究任务，将只执行前 2 个`);
      const researchTaskIds = new Set(allResearchTasks.slice(0, 2).map(t => t.id));
      result.plan = result.plan.filter((task: Task) => 
        task.agentType !== 'researcher' || researchTaskIds.has(task.id)
      );
    }
    
    const writerTasks = result.plan.filter((task: Task) => task.agentType === 'writer');
    const nonWriterTasks = result.plan.filter((task: Task) => task.agentType !== 'writer');
    
    if (writerTasks.length > 0) {
      result.plan = [...nonWriterTasks, writerTasks[writerTasks.length - 1]];
    }
    
    // 直接取 plan 的第一项来决定下一步
    const nextTask = result.plan[0];
    
    // 使用 clack 打印计划列表
    const planOverview = result.plan
      .map((task: Task, index: number) => {
        const agentTypeEmoji = task.agentType === 'researcher' ? '🔍' 
          : task.agentType === 'writer' ? '✍️' 
          : '🎨';
        return `${index + 1}. ${agentTypeEmoji} [${task.agentType}] ${task.taskName}`;
      })
      .join('\n');
    
    note(planOverview, `📊 营销计划 (共 ${result.plan.length} 个任务)`);
    
    if (!nextTask) {
      return {
        planningResult: result,
        plan: result.plan,
        needMoreInfo: false, // 重置 needMoreInfo
        currentStep: 'complete',
      };
    }
    
    // 根据第一个任务的类型决定下一步
    const nextStep = nextTask.agentType === 'researcher' ? 'research' 
      : nextTask.agentType === 'writer' ? 'writer' 
      : 'complete';
    
    return {
      planningResult: result,
      plan: result.plan,
      needMoreInfo: false, // 重置 needMoreInfo
      nextTask,
      currentTaskIndex: 0,
      currentStep: nextStep,
    };
  } catch (error) {
    spin.stop('规划失败 ❌');
    console.error('[Agent] 规划失败:', error);
    return {
      error: `规划失败: ${error instanceof Error ? error.message : String(error)}`,
      currentStep: 'error',
    };
  }
}

/**
 * 节点2: 研究阶段
 * 执行当前的研究任务
 */
async function research(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const spin = spinner();
  const currentTask = state.nextTask;
  
  if (!currentTask || currentTask.agentType !== 'researcher') {
    // 当前任务不是研究任务，移动到下一个任务
    return getNextTask(state);
  }
  
  spin.start(`正在执行研究任务: ${currentTask.taskName}...`);
  
  try {
    const report = await runDeepResearch(currentTask.description);
    
    spin.stop(`研究任务完成: ${currentTask.taskName}`);
    
    // 保存研究报告，并移动到下一个任务
    const nextState = getNextTask(state);
    return {
      researchReports: {
        [currentTask.id]: report,
      },
      ...nextState,
    };
  } catch (error) {
    spin.stop(`研究任务失败: ${currentTask.taskName} ❌`);
    console.error(`[Agent] 研究任务 ${currentTask.id} 失败:`, error);
    
    // 即使失败也保存错误信息，并移动到下一个任务
    const nextState = getNextTask(state);
    return {
      researchReports: {
        [currentTask.id]: `研究任务执行失败: ${error instanceof Error ? error.message : String(error)}`,
      },
      ...nextState,
    };
  }
}

/**
 * 节点3: 写作阶段
 * 基于研究报告生成最终营销方案
 * 注意：writer 是最后一步，执行完成后直接结束
 */
async function writing(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const spin = spinner();
  const currentTask = state.nextTask;
  
  if (!currentTask || currentTask.agentType !== 'writer') {
    // 当前任务不是写作任务，直接结束（不应该发生，但作为保护）
    return {
      currentStep: 'complete',
    };
  }
  
  spin.start(`正在生成营销方案: ${currentTask.taskName}...`);
  
  try {
    // 聚合所有研究报告（如果还没有聚合的话）
    let researchReport = state.aggregatedResearchReport;
    if (!researchReport) {
      const reports = state.researchReports ?? {};
      researchReport = Object.keys(reports).length > 0
        ? Object.values(reports).join('\n\n---\n\n')
        : '';
    }
    
    const finalPlan = await runWriterAgent(
      researchReport,
      state.userInput,
      2 // 最大反思次数
    );
    
    spin.stop(`营销方案生成完成: ${currentTask.taskName}`);
    
    return {
      finalPlan,
      aggregatedResearchReport: researchReport, // 保存聚合的研究报告
      currentStep: 'complete',
    };
  } catch (error) {
    spin.stop(`营销方案生成失败: ${currentTask.taskName} ❌`);
    console.error('[Agent] 写作失败:', error);
    return {
      error: `写作失败: ${error instanceof Error ? error.message : String(error)}`,
      currentStep: 'error',
    };
  }
}

/**
 * 获取下一个任务
 * 根据 currentTaskIndex 从 plan 中获取下一个任务
 */
function getNextTask(state: AgentStateType): Partial<AgentStateType> {
  const currentIndex = state.currentTaskIndex ?? -1;
  const plan = state.plan ?? [];
  const nextIndex = currentIndex + 1;
  
  // 如果还有下一个任务
  if (nextIndex < plan.length) {
    const nextTask = plan[nextIndex];
    
    // 根据任务类型决定下一步
    const nextStep = nextTask.agentType === 'researcher' ? 'research' 
      : nextTask.agentType === 'writer' ? 'writer' 
      : 'complete'; // designer 或其他类型暂时跳过
    
    return {
      nextTask,
      currentTaskIndex: nextIndex,
      currentStep: nextStep,
    };
  }
  
  // 所有任务完成，聚合研究报告（如果有多个研究任务）
  const researchReports = state.researchReports ?? {};
  if (Object.keys(researchReports).length > 0) {
    const aggregatedReport = Object.values(researchReports).join('\n\n---\n\n');
    return {
      aggregatedResearchReport: aggregatedReport,
      currentStep: 'complete',
    };
  }
  
  return {
    currentStep: 'complete',
  };
}

/**
 * 条件边：决定下一步（从 planning 节点）
 */
function routeAfterPlanning(state: AgentStateType): string {
  // 如果有错误，结束
  if (state.error) {
    return 'end';
  }
  
  // 如果需要重新规划（用户补充了信息）
  if (state.currentStep === 'planning' && state.needMoreInfo && state.userClarifications) {
    return 'planning'; // 重新规划
  }
  
  // 根据 nextTask 的类型决定下一步
  if (state.currentStep === 'research') {
    return 'research';
  } else if (state.currentStep === 'writer') {
    return 'writer';
  } else if (state.currentStep === 'complete') {
    return 'end';
  } else {
    return 'end'; // error 或其他情况
  }
}

/**
 * 条件边：决定下一步（从 research 节点）
 */
function routeAfterResearch(state: AgentStateType): string {
  // 如果有错误，结束
  if (state.error) {
    return 'end';
  }
  
  // 如果已完成，结束
  if (state.currentStep === 'complete') {
    return 'end';
  }
  
  // 根据 currentStep 决定下一步（已经在 getNextTask 中设置好了）
  if (state.currentStep === 'research') {
    return 'research'; // 继续下一个研究任务
  } else if (state.currentStep === 'writer') {
    return 'writer'; // 进入写作阶段
  } else {
    return 'end'; // 完成
  }
}

// 构建 Agent 工作流图
const agentWorkflow = new StateGraph(AgentState)
  .addNode('planning', planning)
  .addNode('research', research)
  .addNode('writer', writing)
  .addEdge(START, 'planning')
  .addConditionalEdges('planning', routeAfterPlanning, {
    planning: 'planning', // 重新规划
    research: 'research',
    writer: 'writer',
    end: END,
  })
  .addConditionalEdges('research', routeAfterResearch, {
    research: 'research',
    writer: 'writer',
    end: END,
  })
  .addEdge('writer', END);

// 创建 checkpoint
const checkpointer = new MemorySaver();

// 编译工作流
export const marketingAgent = agentWorkflow.compile({
  checkpointer,
});

/**
 * 执行完整的营销方案生成流程
 * @param userInput - 用户输入的营销需求
 * @param threadId - 可选的线程ID，用于状态持久化
 * @returns 最终营销方案
 */
export async function runMarketingAgent(
  userInput: string,
  threadId?: string
): Promise<string> {
  const finalThreadId = threadId || `marketing-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  try {
    const result = await marketingAgent.invoke(
      {
        userInput,
        currentStep: 'planning',
      },
      {
        configurable: {
          thread_id: finalThreadId,
        },
      }
    );
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    return result.finalPlan || result.aggregatedResearchReport || '未能生成最终方案';
  } catch (error) {
    console.error('[Agent] 执行失败:', error);
    throw error;
  }
}

