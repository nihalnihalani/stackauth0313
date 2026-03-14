import { config } from '../../config.js';
import { Message } from '../../types.js';

async function processStream(response: Response, onLine: (line: string) => void): Promise<void> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) return;

  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.trim()) onLine(line.trim());
    }
  }
  if (buffer.trim()) onLine(buffer.trim());
}

export async function streamOllama(params: {
  model: string;
  systemInstruction: string;
  history: Message[];
  prompt: string;
  onChunk: (text: string) => void;
  signal?: AbortSignal;
  customSystemInstruction?: string;
}): Promise<void> {
  const messages = [
    ...(params.history.length > 0 ? [{ role: 'system', content: params.systemInstruction }] : []),
    ...(params.customSystemInstruction ? [{ role: 'system', content: params.customSystemInstruction }] : []),
    ...params.history.map(m => {
      const msgObj: any = { role: m.role === 'model' ? 'assistant' : 'user', content: m.text };
      if (m.attachments && m.attachments.length > 0) {
        msgObj.images = m.attachments.filter(a => a.type === 'image').map(a => a.data);
      }
      return msgObj;
    }),
    { role: 'user', content: params.prompt },
  ];

  const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: params.model || 'llama3',
      messages,
      stream: true,
    }),
    signal: params.signal,
  });

  if (!response.ok) throw new Error('Ollama connection failed');

  await processStream(response, (line) => {
    try {
      const json = JSON.parse(line);
      if (json.message?.content) params.onChunk(json.message.content);
    } catch (e) {
      // Skip malformed lines
    }
  });
}

export async function generateOllama(params: {
  model?: string;
  systemInstruction?: string;
  prompt: string;
}): Promise<string> {
  let fullText = '';
  await streamOllama({
    model: params.model || 'llama3',
    systemInstruction: params.systemInstruction || '',
    history: [],
    prompt: params.prompt,
    onChunk: (text) => { fullText += text; },
  });
  return fullText;
}
