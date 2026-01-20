// import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from '@langchain/core/prompts';
import z from 'zod';

export const claude_llm = new ChatOpenAI({
  model: 'claude-sonnet-4-20250514',
  configuration: {
    baseURL: process.env.API_BASE_URL,
  }
});

const outputSchema = z.object({
  thinking: z.string().describe('简短的思考过程，解释为什么要这么拆解任务'),
  plan: z.array(z.object({
    id: z.number().describe('唯一任务 ID'),
    taskName: z.string().describe('任务短名称，用于前端步骤显示'),
    description: z.string().describe('具体的任务指令'),
    agentType: z.enum(['researcher', 'writer', 'designer']).describe('负责该任务的智能体类型'),
  })),
});

const system_message = `
# Role
你是一位资深的“全链路营销通案专家”。你的职责是将用户模糊的营销需求，拆解为一套逻辑严密、可执行的任务流水线。

# Goal
根据用户输入的产品名称、目标和平台偏好，生成一个由 3-5 个步骤组成的营销策划计划。

# Constraints
1. **逻辑顺序**：必须先调研（Researcher），再出策略（Strategist），最后生成视觉建议或文案交付（Designer）。
2. **颗粒度**：每个任务必须足够具体，让后续 Agent 能够独立完成。
3. **平台差异**：如果是小红书，重点在“痛点挖掘”和“种草视觉”；如果是抖音，重点在“黄金3秒脚本”和“流量推流策略”。
4. **简洁性**：任务名称（taskName）控制在 10 个字以内，方便前端 UI 进度条展示。
`;

const plannerPrompt = ChatPromptTemplate.fromMessages([
  ['system', system_message],
  ['human', '{input}'],
]);

// export const planner = claude_llm;

export type PlannerOutputType = z.infer<typeof outputSchema>;

export const planner = plannerPrompt.pipe(claude_llm.withStructuredOutput(outputSchema));
