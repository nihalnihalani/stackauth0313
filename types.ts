
export interface Attachment {
  type: 'image' | 'file';
  mimeType: string;
  data: string; // base64
  name?: string;
}

export interface Message {
  id: string;
  chatId?: string;
  role: 'user' | 'model' | 'system';
  text: string;
  comparisonText?: string;
  timestamp?: number;
  attachments?: Attachment[];
}

export interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  timestamp: number;
}

export interface AppConfig {
  provider: string;
  model: string;
  mode: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswerIndex: number; // 0-3
  explanation: string;
}
