import { config } from '../../config.js';
import { Message, Attachment } from '../../types.js';

/** Strip API key patterns from error messages to prevent leaking secrets to clients */
function sanitizeError(message: string): string {
  return message.replace(/sk-[a-zA-Z0-9-_]{20,}|AIza[a-zA-Z0-9-_]{30,}/g, '[REDACTED]');
}

function getBaseUrl(): string {
  return config.openaiBaseUrl;
}

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

export async function streamOpenAI(params: {
  model: string;
  systemInstruction: string;
  history: Message[];
  prompt: string;
  onChunk: (text: string) => void;
  signal?: AbortSignal;
  customSystemInstruction?: string;
}): Promise<void> {
  const messages: any[] = [
    ...(params.history.length > 0 ? [{ role: 'system', content: params.systemInstruction }] : []),
    ...(params.customSystemInstruction ? [{ role: 'system', content: params.customSystemInstruction }] : []),
    ...params.history.map(m => {
      const content: any[] = [{ type: 'text', text: m.text }];
      if (m.attachments) {
        m.attachments.forEach(att => {
          if (att.type === 'image') {
            content.push({
              type: 'image_url',
              image_url: { url: `data:${att.mimeType};base64,${att.data}` },
            });
          }
        });
      }
      return { role: m.role === 'model' ? 'assistant' : 'user', content };
    }),
    { role: 'user', content: params.prompt },
  ];

  const response = await fetch(`${getBaseUrl()}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: params.model || 'gpt-4o',
      messages,
      stream: true,
    }),
    signal: params.signal,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI Error: ${sanitizeError(err)}`);
  }

  await processStream(response, (line) => {
    if (line.startsWith('data: ')) {
      const data = line.substring(6);
      if (data === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const content = json.choices?.[0]?.delta?.content;
        if (content) params.onChunk(content);
      } catch (e) {
        // Skip malformed SSE lines
      }
    }
  });
}

export async function generateOpenAI(params: {
  model?: string;
  systemInstruction?: string;
  prompt: string;
}): Promise<string> {
  let fullText = '';
  await streamOpenAI({
    model: params.model || 'gpt-4o',
    systemInstruction: params.systemInstruction || '',
    history: [],
    prompt: params.prompt,
    onChunk: (text) => { fullText += text; },
  });
  return fullText;
}

export async function processDocumentOpenAI(params: {
  model?: string;
  prompt: string;
  attachment: Attachment;
}): Promise<string> {
  if (params.attachment.type !== 'image') {
    throw new Error('OpenAI only supports image attachments for document processing.');
  }

  const response = await fetch(`${getBaseUrl()}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: params.model || 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: params.prompt },
          { type: 'image_url', image_url: { url: `data:${params.attachment.mimeType};base64,${params.attachment.data}` } },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI Error: ${sanitizeError(err)}`);
  }

  const json = await response.json() as any;
  return json.choices?.[0]?.message?.content || '';
}
