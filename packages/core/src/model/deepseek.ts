import { ChatDeepSeek } from '@langchain/deepseek';

export const deepseek_llm = new ChatDeepSeek({
  model: 'deepseek-v3-250324',
  configuration: {
    baseURL: process.env.API_BASE_URL,
  },
});
