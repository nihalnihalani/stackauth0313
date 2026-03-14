import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { requireAuth } from '../middleware/auth.js';
import { getSystemInstructionForMode } from '../services/llm/index.js';
import { config } from '../config.js';
import { ChatStreamRequest } from '../types.js';

export const chatRouter = Router();

// Google: use regular JSON response (SSE flush doesn't work with Google SDK's await)
chatRouter.post('/chat/stream', requireAuth, async (req: Request, res: Response) => {
  const body = req.body as ChatStreamRequest;

  if (!body.provider || !body.prompt) {
    res.status(400).json({ error: 'Missing required fields: provider, prompt' });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    const systemInstruction = body.systemInstruction || getSystemInstructionForMode(body.mode || 'direct');

    const result = await ai.models.generateContent({
      model: body.model || 'gemini-3-flash-preview',
      config: { systemInstruction },
      contents: [
        ...(body.history || []).filter((m: any) => m.role !== 'system').map((m: any) => ({
          role: m.role,
          parts: [{ text: m.text }],
        })),
        { role: 'user', parts: [{ text: body.prompt }] },
      ],
    });

    const text = result.text || '';
    res.json({ text });
  } catch (error) {
    console.error('[chat] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
