import { config } from '../../config.js';
import { Message, Attachment } from '../../types.js';

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

export async function streamAnthropic(params: {
  model: string;
  systemInstruction: string;
  history: Message[];
  prompt: string;
  onChunk: (text: string) => void;
  signal?: AbortSignal;
  customSystemInstruction?: string;
}): Promise<void> {
  const correctedHistory = [...params.history];
  if (correctedHistory.length > 0 && correctedHistory[0].role === 'model') {
    correctedHistory.unshift({
      id: 'system_injection',
      role: 'user',
      text: 'Context: Continuing conversation from the following previous output.',
    });
  }

  const anthropicMessages = [
    ...correctedHistory.map(m => {
      const content: any[] = [];
      if (m.attachments) {
        m.attachments.forEach(att => {
          if (att.type === 'image') {
            content.push({
              type: 'image',
              source: { type: 'base64', media_type: att.mimeType, data: att.data },
            });
          }
        });
      }
      if (m.text) content.push({ type: 'text', text: m.text });
      return { role: m.role === 'model' ? 'assistant' : 'user', content };
    }),
    { role: 'user', content: params.prompt },
  ];

  const systemText = params.history.length > 0
    ? params.systemInstruction
    : (params.customSystemInstruction || params.systemInstruction);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      // No 'anthropic-dangerously-allow-browser' needed server-side
    },
    body: JSON.stringify({
      model: params.model || 'claude-3-5-sonnet-20240620',
      max_tokens: 4096,
      system: systemText,
      messages: anthropicMessages,
      stream: true,
    }),
    signal: params.signal,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic Error: ${err}`);
  }

  await processStream(response, (line) => {
    if (line.startsWith('data: ')) {
      const data = line.substring(6);
      try {
        const json = JSON.parse(data);
        if (json.type === 'content_block_delta' && json.delta?.text) {
          params.onChunk(json.delta.text);
        }
      } catch (e) {
        // Skip malformed SSE lines
      }
    }
  });
}

export async function generateAnthropic(params: {
  model?: string;
  systemInstruction?: string;
  prompt: string;
}): Promise<string> {
  let fullText = '';
  await streamAnthropic({
    model: params.model || 'claude-3-5-sonnet-20240620',
    systemInstruction: params.systemInstruction || '',
    history: [],
    prompt: params.prompt,
    onChunk: (text) => { fullText += text; },
  });
  return fullText;
}

export async function processDocumentAnthropic(params: {
  model?: string;
  prompt: string;
  attachment: Attachment;
}): Promise<string> {
  const content: any[] = [];
  if (params.attachment.type === 'image') {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: params.attachment.mimeType, data: params.attachment.data },
    });
  } else {
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: params.attachment.mimeType, data: params.attachment.data },
    });
  }
  content.push({ type: 'text', text: params.prompt });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model || 'claude-3-5-sonnet-20240620',
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic Error: ${err}`);
  }

  const json = await response.json() as any;
  return json.content?.[0]?.text || '';
}
