// import dotenv from 'dotenv';
// import path from 'path';
import { Hono } from 'hono'
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server'
import { openai_llm } from '@your_radar/core';
import { createUIMessageStreamResponse } from 'ai';
import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';

console.log('process.env.API_BASE_URL', process.env.API_BASE_URL);

const app = new Hono();

app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.post('/api/chat', async (c) => {
  const { messages } = await c.req.json();
  console.log('请求消息', messages);
  const langchainMessages = await toBaseMessages(messages);
  const result = await openai_llm.stream(langchainMessages);

  return createUIMessageStreamResponse({
    stream: toUIMessageStream(result),
  });
});

serve({
  fetch: app.fetch,
  port: 4000
}, (info) => {
  console.log(`Server is running on http://127.0.0.1:${info.port}`)
})
