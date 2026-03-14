import { GoogleGenAI } from '@google/genai';
import { config } from '../../config.js';
import { Message, Attachment } from '../../types.js';

const FAST_MODEL = 'gemini-2.5-flash';
const THINKING_MODEL = 'gemini-3-pro-preview';

function getAI() {
  return new GoogleGenAI({ apiKey: config.geminiApiKey });
}

export async function streamGoogle(params: {
  model: string;
  systemInstruction: string;
  history: Message[];
  prompt: string;
  onChunk: (text: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const ai = getAI();

  let previousHistory = params.history;
  let currentAttachments: Attachment[] | undefined;

  if (params.history.length > 0) {
    const lastMsg = params.history[params.history.length - 1];
    if (lastMsg.role === 'user') {
      previousHistory = params.history.slice(0, -1);
      currentAttachments = lastMsg.attachments;
    }
  }

  const chatSession = ai.chats.create({
    model: params.model || THINKING_MODEL,
    config: { systemInstruction: params.systemInstruction },
    history: previousHistory.filter(m => m.role !== 'system').map(m => {
      const parts: any[] = [{ text: m.text }];
      if (m.attachments) {
        m.attachments.forEach(att => {
          parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
        });
      }
      return { role: m.role, parts };
    }),
  });

  const parts: any[] = [{ text: params.prompt }];
  if (currentAttachments) {
    currentAttachments.forEach(att => {
      parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
    });
  }

  const result = await chatSession.sendMessageStream({ message: parts });
  for await (const chunk of result) {
    if (params.signal?.aborted) break;
    if (chunk.text) params.onChunk(chunk.text);
  }
}

export async function generateGoogle(params: {
  model?: string;
  systemInstruction?: string;
  prompt: string;
}): Promise<string> {
  const ai = getAI();
  let fullText = '';

  const chatSession = ai.chats.create({
    model: params.model || FAST_MODEL,
    config: params.systemInstruction ? { systemInstruction: params.systemInstruction } : {},
    history: [],
  });

  const result = await chatSession.sendMessageStream({ message: params.prompt });
  for await (const chunk of result) {
    if (chunk.text) fullText += chunk.text;
  }
  return fullText;
}

export async function processDocumentGoogle(params: {
  model?: string;
  prompt: string;
  attachment: Attachment;
}): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: params.model || FAST_MODEL,
    contents: {
      parts: [
        { text: params.prompt },
        { inlineData: { mimeType: params.attachment.mimeType, data: params.attachment.data } },
      ],
    },
    config: { responseMimeType: 'application/json' },
  });
  return response.text || '';
}
