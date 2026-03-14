import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// SSE test endpoint
healthRouter.get('/test-sse', (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let i = 0;
  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ text: `chunk ${i}` })}\n\n`);
    i++;
    if (i >= 3) {
      clearInterval(interval);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }, 500);
});
