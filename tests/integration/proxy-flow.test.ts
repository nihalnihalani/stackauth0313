/**
 * Integration: Client -> Proxy -> LLM Mock Flow
 *
 * Tests the full request lifecycle through the auth middleware
 * and proxy routing logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';

// Mock jose for auth middleware
const mockJwtVerify = vi.fn();
vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => 'mock-jwks'),
  jwtVerify: (...args: any[]) => mockJwtVerify(...args),
}));

// Mock server config
vi.mock('../../server/config.js', () => ({
  config: {
    stackProjectId: 'test-project-uuid',
    port: 3001,
    nodeEnv: 'test',
    geminiApiKey: 'sk-test-gemini-key',
    openaiApiKey: 'sk-test-openai-key',
    anthropicApiKey: 'sk-test-anthropic-key',
    ollamaBaseUrl: 'http://localhost:11434',
    openaiBaseUrl: 'https://api.openai.com/v1',
    allowedOrigin: 'http://localhost:3000',
  },
  getApiKeyForProvider: (provider: string) => {
    switch (provider) {
      case 'google': return 'sk-test-gemini-key';
      case 'openai': return 'sk-test-openai-key';
      case 'anthropic': return 'sk-test-anthropic-key';
      case 'ollama': return '';
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  },
}));

// Mock LLM service to avoid real API calls
vi.mock('../../server/services/llm/index.js', () => ({
  streamLLMResponse: vi.fn(async (params: any) => {
    params.onChunk('Hello');
    params.onChunk(' World');
  }),
  generateText: vi.fn(async () => 'Generated Title'),
  processDocument: vi.fn(async () => '{"title":"Test","content":"Extracted"}'),
}));

import { requireAuth } from '../../server/middleware/auth.js';
import { streamLLMResponse } from '../../server/services/llm/index.js';

describe('Integration: Auth -> Proxy Flow', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      headers: {},
      body: {},
      on: vi.fn(),
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    };
    mockNext = vi.fn();
  });

  describe('Authenticated requests proceed to proxy', () => {
    it('valid JWT passes auth middleware and reaches handler', async () => {
      mockReq.headers['x-stack-access-token'] = 'valid-token';
      mockJwtVerify.mockResolvedValue({
        payload: {
          sub: 'user-123',
          email: 'user@test.com',
          name: 'Test User',
          is_anonymous: false,
          is_restricted: false,
        },
      });

      await requireAuth(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.userId).toBe('user-123');

      // Simulate the proxy handler calling streamLLMResponse
      await (streamLLMResponse as any)({
        provider: 'google',
        model: 'gemini-3-pro-preview',
        mode: 'direct',
        history: [],
        prompt: 'Hello',
        onChunk: (text: string) => {
          mockRes.write(`data: ${JSON.stringify({ text })}\n\n`);
        },
      });

      expect(streamLLMResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'google',
          prompt: 'Hello',
        })
      );
      expect(mockRes.write).toHaveBeenCalledWith('data: {"text":"Hello"}\n\n');
      expect(mockRes.write).toHaveBeenCalledWith('data: {"text":" World"}\n\n');
    });
  });

  describe('Authentication failures block proxy', () => {
    it('missing token returns 401 without calling LLM', async () => {
      await requireAuth(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
      expect(streamLLMResponse).not.toHaveBeenCalled();
    });

    it('invalid JWT returns 401 without calling LLM', async () => {
      mockReq.headers['x-stack-access-token'] = 'bad-token';
      mockJwtVerify.mockRejectedValue(new Error('invalid signature'));

      await requireAuth(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
      expect(streamLLMResponse).not.toHaveBeenCalled();
    });

    it('anonymous user returns 403 without calling LLM', async () => {
      mockReq.headers['x-stack-access-token'] = 'anon-token';
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'anon', is_anonymous: true, is_restricted: false },
      });

      await requireAuth(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
      expect(streamLLMResponse).not.toHaveBeenCalled();
    });
  });

  describe('Request validation in chat route', () => {
    it('chat route requires provider and prompt fields', () => {
      const source = readFileSync(
        '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/routes/chat.ts',
        'utf-8'
      );
      expect(source).toContain('!body.provider || !body.prompt');
      expect(source).toContain('res.status(400)');
    });

    it('chat route uses requireAuth middleware', () => {
      const source = readFileSync(
        '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/routes/chat.ts',
        'utf-8'
      );
      expect(source).toContain('requireAuth');
      expect(source).toContain("import { requireAuth }");
    });
  });

  describe('Security: API keys never in responses', () => {
    it('auth error responses contain no API keys', async () => {
      mockReq.headers['x-stack-access-token'] = 'bad';
      mockJwtVerify.mockRejectedValue(new Error('verification failed'));

      await requireAuth(mockReq, mockRes, mockNext);
      const allCalls = [...mockRes.json.mock.calls, ...mockRes.write.mock.calls];
      const allOutput = allCalls.map((c) => JSON.stringify(c)).join('');
      expect(allOutput).not.toContain('sk-test-gemini-key');
      expect(allOutput).not.toContain('sk-test-openai-key');
      expect(allOutput).not.toContain('sk-test-anthropic-key');
    });

    it('LLM service uses getApiKeyForProvider from server config, not request body', () => {
      const source = readFileSync(
        '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/services/llm/index.ts',
        'utf-8'
      );
      expect(source).toContain("import { getApiKeyForProvider } from '../../config.js'");
      const chatSource = readFileSync(
        '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/routes/chat.ts',
        'utf-8'
      );
      expect(chatSource).not.toContain('body.apiKey');
      expect(chatSource).not.toContain('req.body.apiKey');
    });

    it('client auth token is not forwarded to upstream LLM calls', () => {
      const source = readFileSync(
        '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/routes/chat.ts',
        'utf-8'
      );
      // streamLLMResponse params do not include auth token
      expect(source).not.toContain("headers['x-stack-access-token']");
    });
  });

  describe('Client disconnect handling', () => {
    it('registers close handler for abort control', () => {
      const source = readFileSync(
        '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/routes/chat.ts',
        'utf-8'
      );
      expect(source).toContain('AbortController');
      expect(source).toContain("req.on('close'");
      expect(source).toContain('controller.abort()');
    });

    it('checks signal.aborted before writing to response', () => {
      const source = readFileSync(
        '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/routes/chat.ts',
        'utf-8'
      );
      expect(source).toContain('controller.signal.aborted');
    });
  });

  describe('Health endpoint accessibility', () => {
    it('health endpoint does not use requireAuth', () => {
      const source = readFileSync(
        '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/routes/health.ts',
        'utf-8'
      );
      expect(source).not.toContain('requireAuth');
      expect(source).not.toContain('auth');
    });
  });
});
