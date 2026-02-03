import { ChatDeepSeek } from '@langchain/deepseek';
import { Provider } from "@/constant/provider";

export const deepseek_llm = new ChatDeepSeek({
  model: Provider.DEEPSEEK_V3_250324,
  configuration: {
    baseURL: process.env.API_BASE_URL,
  },
});
