import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Stack Auth
  stackProjectId: process.env.STACK_PROJECT_ID || '',
  stackSecretServerKey: process.env.STACK_SECRET_SERVER_KEY || '',

  // LLM API Keys
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',

  // Base URLs
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',

  // CORS
  allowedOrigin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
} as const;

export function getApiKeyForProvider(provider: string): string {
  switch (provider) {
    case 'google': return config.geminiApiKey;
    case 'openai': return config.openaiApiKey;
    case 'anthropic': return config.anthropicApiKey;
    case 'ollama': return ''; // Ollama doesn't need an API key
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

export function validateConfig(): void {
  if (!config.stackProjectId) {
    console.warn('WARNING: STACK_PROJECT_ID is not set. Auth middleware will reject all requests.');
  }
  const hasAnyKey = config.geminiApiKey || config.openaiApiKey || config.anthropicApiKey;
  if (!hasAnyKey) {
    console.warn('WARNING: No LLM API keys configured. Set at least one of GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY.');
  }
}
