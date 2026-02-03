import { ChatOpenAI } from "@langchain/openai";
import { Provider } from "@/constant/provider";

export const openai_llm = new ChatOpenAI({
  model: Provider.OPEN_AI_GPT_5_1_CHAT,
  configuration: {
    baseURL: process.env.API_BASE_URL,
  }
});
