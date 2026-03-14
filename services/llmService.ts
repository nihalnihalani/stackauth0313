
import { Message, AppConfig, Note, Attachment } from '../types';

// Token getter type -- called before each request to get a fresh access token
type GetAccessToken = () => Promise<string | null>;

// --- SSE Stream Reader (unified for all proxy endpoints) ---

const readProxyStream = async (
  response: Response,
  onChunk: (text: string) => void
): Promise<void> => {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) throw new Error('No response body');

  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.text) onChunk(parsed.text);
        } catch (e) {
          if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
            throw e;
          }
        }
      }
    }
  }
};

// --- Auth Header Builder ---

const buildHeaders = async (getToken: GetAccessToken): Promise<Record<string, string>> => {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['x-stack-access-token'] = token;
  }
  return headers;
};

// --- Public API ---

export const streamResponse = async (
  getToken: GetAccessToken,
  config: AppConfig,
  history: Message[],
  prompt: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<void> => {
  const headers = await buildHeaders(getToken);

  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      provider: config.provider,
      model: config.model,
      mode: config.mode,
      history: history.map(m => ({
        id: m.id,
        role: m.role,
        text: m.text,
        attachments: m.attachments,
      })),
      prompt,
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Server error (${response.status}): ${err}`);
  }

  await readProxyStream(response, onChunk);
};

export const processDocument = async (
  getToken: GetAccessToken,
  config: AppConfig,
  attachment: Attachment
): Promise<{ title: string; content: string }> => {
  const headers = await buildHeaders(getToken);

  const response = await fetch('/api/process-document', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      provider: config.provider,
      model: config.model,
      attachment,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Document processing failed (${response.status}): ${err}`);
  }

  return response.json();
};

export const generateTitle = async (
  getToken: GetAccessToken,
  config: AppConfig,
  content: string
): Promise<string> => {
  const headers = await buildHeaders(getToken);

  try {
    const response = await fetch('/api/generate-title', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        provider: config.provider,
        model: config.model,
        content,
      }),
    });

    if (!response.ok) {
      throw new Error(`Title generation failed (${response.status})`);
    }

    const json = await response.json();
    return json.title || 'Saved Note';
  } catch (e) {
    console.error('Title generation failed', e);
    return 'Saved Note';
  }
};

export const generateSyllabus = async (
  getToken: GetAccessToken,
  config: AppConfig,
  notes: Note[],
  onChunk: (text: string) => void,
  currentSyllabusJson?: string
): Promise<void> => {
  if (notes.length === 0) {
    onChunk(JSON.stringify({ title: 'Empty Archives', modules: [] }));
    return;
  }

  const headers = await buildHeaders(getToken);

  const response = await fetch('/api/generate-syllabus', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      provider: config.provider,
      model: config.model,
      notes: notes.map(n => ({ title: n.title, content: n.content })),
      currentSyllabusJson,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Syllabus generation failed (${response.status}): ${err}`);
  }

  await readProxyStream(response, onChunk);
};

export const generateAssessment = async (
  getToken: GetAccessToken,
  config: AppConfig,
  topic: string,
  notes: Note[],
  onChunk: (text: string) => void
): Promise<void> => {
  const headers = await buildHeaders(getToken);

  const response = await fetch('/api/generate-assessment', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      provider: config.provider,
      model: config.model,
      topic,
      notes: notes.map(n => ({ title: n.title, content: n.content })),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Assessment generation failed (${response.status}): ${err}`);
  }

  await readProxyStream(response, onChunk);
};
