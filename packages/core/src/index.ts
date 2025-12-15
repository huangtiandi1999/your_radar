import { createAgent, tool } from "langchain";
import { ChatDeepSeek } from '@langchain/deepseek';
import { z } from "zod";

// Load environment variables from .env file
import 'dotenv/config';

const getWeather = tool(
  (input) => `It's always sunny in ${input.city}!`,
  {
    name: "get_weather",
    description: "Get the weather for a given city",
    schema: z.object({
      city: z.string().describe("The city to get the weather for"),
    }),
  }
);

const llm = new ChatDeepSeek({
  model: 'deepseek-chat',
  temperature: 0,
});

const agent = createAgent({
  model: llm,
  tools: [getWeather],
});

console.log(
  await agent.invoke({
    messages: [{ role: "user", content: "What's the weather in Tokyo?" }],
  })
);