import { Request } from 'express';

export interface Attachment {
  type: 'image' | 'file';
  mimeType: string;
  data: string; // base64
  name?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  attachments?: Attachment[];
}

export interface ChatStreamRequest {
  provider: string;
  model: string;
  mode: string;
  systemInstruction?: string;
  history: Message[];
  prompt: string;
}

export interface GenerateTitleRequest {
  provider: string;
  model?: string;
  content: string;
}

export interface GenerateSyllabusRequest {
  provider: string;
  model?: string;
  notes: Array<{ title: string; content: string }>;
  currentSyllabusJson?: string;
}

export interface GenerateAssessmentRequest {
  provider: string;
  model?: string;
  topic: string;
  notes: Array<{ title: string; content: string }>;
}

export interface ProcessDocumentRequest {
  provider: string;
  model?: string;
  attachment: Attachment;
}

export interface AuthenticatedRequest extends Request {
  userId: string;
  userEmail?: string;
  userName?: string;
}
