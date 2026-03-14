import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { requireAuth } from '../middleware/auth.js';
import { streamLLMResponse } from '../services/llm/index.js';
import { config } from '../config.js';
import { ChatStreamRequest } from '../types.js';

export const chatRouter = Router();

chatRouter.post('/chat/stream', requireAuth, async (req: Request, res: Response) => {
  const body = req.body as ChatStreamRequest;

  if (!body.provider || !body.prompt) {
    res.status(400).json({ error: 'Missing required fields: provider, prompt' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(':ok\n\n');

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    if (body.provider === 'google') {
      // Direct Google streaming to bypass abstraction issues
      const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
      const chat = ai.chats.create({
        model: body.model || 'gemini-2.5-flash',
        config: { systemInstruction: body.systemInstruction || 'You are a helpful assistant. Be concise.' },
        history: (body.history || []).filter((m: any) => m.role !== 'system').map((m: any) => ({
          role: m.role,
          parts: [{ text: m.text }],
        })),
      });

      // Use non-streaming generateContent, then send result as SSE
      const result = await ai.models.generateContent({
        model: body.model || 'gemini-2.5-flash',
        config: { systemInstruction: body.systemInstruction || 'You are a helpful assistant. Be concise.' },
        contents: [
          ...(body.history || []).filter((m: any) => m.role !== 'system').map((m: any) => ({
            role: m.role,
            parts: [{ text: m.text }],
          })),
          { role: 'user', parts: [{ text: body.prompt }] },
        ],
      });
      const text = result.text || '';
      if (text) {
        const payload = `data: ${JSON.stringify({ text })}\n\n`;
        res.write(payload);
      }
    } else {
      await streamLLMResponse({
        provider: body.provider,
        model: body.model || '',
        mode: body.mode || 'direct',
        history: body.history || [],
        prompt: body.prompt,
        onChunk: (text) => {
          if (!controller.signal.aborted && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        },
        signal: controller.signal,
      });
    }

    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error) {
    console.error('[chat] Error:', error);
    if (!controller.signal.aborted && !res.writableEnded) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  }
});
