import { serve } from '@hono/node-server'
import { cors } from 'hono/cors';
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

serve({
  fetch: app.fetch,
  port: 4000
}, (info) => {
  console.log(`Server is running on http://127.0.0.1:${info.port}`)
})

export type AppType = typeof app;
