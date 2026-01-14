import { serve } from '@hono/node-server'
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { Hono } from 'hono'

const app = new Hono()

app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.get('/api/test', (c) => {
  return c.json({
    name: 'test',
  })
})

app.get('/api/chat', (c) => {
  return streamSSE(
    c, 
    async (stream) => {
      const text = 'hello my name is yefan';
      const words = text.split(' ');
      for (const word of words) {
        await stream.writeSSE({
          data: word + " ",
          event: 'message',
        })
        await stream.sleep(200);
      }
      await stream.writeSSE({
        data: 'end',
        event: 'done',
      })
    },
  );
})

serve({
  fetch: app.fetch,
  port: 4000
}, (info) => {
  console.log(`Server is running on http://127.0.0.1:${info.port}`)
})
