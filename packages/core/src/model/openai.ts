import { ChatOpenAI } from "@langchain/openai";

export const openai_llm = new ChatOpenAI({
  model: 'gpt-5.1-chat',
  configuration: {
    baseURL: process.env.API_BASE_URL,
  }
});
