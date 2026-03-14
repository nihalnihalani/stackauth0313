import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { streamLLMResponse } from '../services/llm/index.js';
import { ChatStreamRequest } from '../types.js';

export const chatRouter = Router();

chatRouter.post('/chat/stream', requireAuth, async (req: Request, res: Response) => {
  const body = req.body as ChatStreamRequest;

  // Validate required fields
  if (!body.provider || !body.prompt) {
    res.status(400).json({ error: 'Missing required fields: provider, prompt' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx/reverse proxy buffering
  res.flushHeaders();

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    await streamLLMResponse({
      provider: body.provider,
      model: body.model || '',
      mode: body.mode || 'direct',
      systemInstruction: body.systemInstruction,
      history: body.history || [],
      prompt: body.prompt,
      onChunk: (text) => {
        if (!controller.signal.aborted) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      },
      signal: controller.signal,
    });

    if (!controller.signal.aborted) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  }
});
