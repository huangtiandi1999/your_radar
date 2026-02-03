import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from '@langchain/core/prompts';
import z from 'zod';
import { Provider } from "@/constant/provider";

export const claude_llm = new ChatOpenAI({
  model: Provider.CLAUDE_SONNET_4_20250514,
  configuration: {
    baseURL: process.env.API_BASE_URL,
  }
});

const outputSchema = z.object({
  /** 意图：营销策划需求走研究与写作流程；简单问询则直接回答 */
  intent: z
    .enum(['marketing', 'simple_question'])
    .describe('用户意图。marketing=需要做营销方案/调研/策划；simple_question=简单问答、概念解释、非营销类问题，直接回答即可'),
  thinking: z.string().describe('简短的思考过程：若是营销需求则解释如何拆解任务；若是简单问询则说明为何判定为简单问题'),
  needMoreInfo: z.boolean().describe('是否需要更多信息（仅对 marketing 意图有效）'),
  clarificationQuestions: z.array(z.string()).optional().describe('如果 needsMoreInfo 为 true，请列出 2-3 个关键问题引导用户补充内容'),
  plan: z.array(z.object({
    id: z.number().describe('唯一任务 ID'),
    taskName: z.string().describe('任务短名称，用于前端步骤显示'),
    description: z.string().describe('具体的任务指令'),
    agentType: z.enum(['researcher', 'writer']).describe('负责该任务的智能体类型'),
  })).optional().describe('仅当 intent 为 marketing 时填写 3-5 个任务；simple_question 时可为空'),
});

const system_message = `
# Role
你是一位资深的“全链路营销通案专家”。你的职责是：先识别用户意图，再对营销需求进行任务拆解；对简单问询则直接回答。

# Intent Recognition（优先执行）
**先判断用户意图，再决定输出：**
- **simple_question**：用户只是简单问询，例如：概念解释、一句话问答、产品/名词是什么、如何操作、非营销策划类问题。此时设置 intent 为 simple_question，不生成 plan，needMoreInfo 设为 false；回答将由后续简单回答节点处理。
- **marketing**：用户明确需要营销方案、策划、调研、推广、种草、投放等与营销相关的一整套产出。此时设置 intent 为 marketing，按下方 Task Evaluation 与 Goal 生成 plan。

# Task Evaluation（仅当 intent 为 marketing 时）
判断信息是否足以支撑一个高标准的方案。
**必须满足以下至少 3 项，否则请设置 needsMoreInfo 为 true：**
1. 明确的产品/品牌名称及其核心卖点。
2. 明确的营销目标（例如：新品首发、节点大促、品牌破圈）。
3. 明确的目标平台（小红书、抖音、B站等）。
4. 明确的受众群体画像。

# Goal（仅当 intent 为 marketing 时）
根据用户输入的产品名称、目标和平台偏好，生成一个由 3-5 个步骤组成的营销策划计划。

# Constraints（仅当 intent 为 marketing 时）
1. **逻辑顺序**：必须先调研（Researcher），再出策略（Strategist），最后文案交付（Writer）。
2. **颗粒度**：每个任务必须足够具体，让后续 Agent 能够独立完成。
3. **平台差异**：如果是小红书，重点在“痛点挖掘”和“种草视觉”；如果是抖音，重点在“黄金3秒脚本”和“流量推流策略”。
4. **简洁性**：任务名称（taskName）控制在 10 个字以内。
`;

const plannerPrompt = ChatPromptTemplate.fromMessages([
  ['system', system_message],
  ['human', '{input}'],
]);

// export const planner = claude_llm;

export type PlannerOutputType = z.infer<typeof outputSchema>;

export const planner = plannerPrompt.pipe(claude_llm.withStructuredOutput(outputSchema));
