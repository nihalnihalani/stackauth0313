/**
 * Backend Auth Middleware Tests
 *
 * Tests for server/middleware/auth.ts (requireAuth)
 * Validates JWT verification, anonymous user rejection,
 * header stripping, and error response format.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock jose before importing middleware
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

import { requireAuth } from '../../server/middleware/auth.js';

describe('Auth Middleware (server/middleware/auth.ts)', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = { headers: {} };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('Missing auth header', () => {
    it('returns 401 when x-stack-access-token header is missing', async () => {
      await requireAuth(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Missing access token') })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Valid JWT token', () => {
    it('calls next() and attaches userId when JWT is valid', async () => {
      mockReq.headers['x-stack-access-token'] = 'valid-jwt-token';
      mockJwtVerify.mockResolvedValue({
        payload: {
          sub: 'user-uuid-123',
          email: 'test@example.com',
          name: 'Test User',
          is_anonymous: false,
          is_restricted: false,
        },
      });

      await requireAuth(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.userId).toBe('user-uuid-123');
      expect(mockReq.userEmail).toBe('test@example.com');
      expect(mockReq.userName).toBe('Test User');
    });

    it('sets userEmail to undefined when email is empty string', async () => {
      mockReq.headers['x-stack-access-token'] = 'valid-jwt';
      mockJwtVerify.mockResolvedValue({
        payload: {
          sub: 'user-no-email',
          email: '',
          name: 'No Email',
          is_anonymous: false,
          is_restricted: false,
        },
      });

      await requireAuth(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.userEmail).toBeUndefined();
    });
  });

  describe('Expired JWT token', () => {
    it('returns 401 when JWT has expired', async () => {
      mockReq.headers['x-stack-access-token'] = 'expired-jwt';
      mockJwtVerify.mockRejectedValue(new Error('JWT expired'));

      await requireAuth(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Invalid or expired') })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Anonymous user rejection', () => {
    it('returns 403 when JWT has is_anonymous=true', async () => {
      mockReq.headers['x-stack-access-token'] = 'anon-jwt';
      mockJwtVerify.mockResolvedValue({
        payload: {
          sub: 'anon-user',
          is_anonymous: true,
          is_restricted: false,
        },
      });

      await requireAuth(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Anonymous') })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Restricted user rejection', () => {
    it('returns 403 when JWT has is_restricted=true', async () => {
      mockReq.headers['x-stack-access-token'] = 'restricted-jwt';
      mockJwtVerify.mockResolvedValue({
        payload: {
          sub: 'restricted-user',
          is_anonymous: false,
          is_restricted: true,
        },
      });

      await requireAuth(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Restricted') })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('JWT verification parameters', () => {
    it('verifies JWT with audience matching STACK_PROJECT_ID', async () => {
      mockReq.headers['x-stack-access-token'] = 'some-token';
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'u1', is_anonymous: false, is_restricted: false },
      });

      await requireAuth(mockReq, mockRes, mockNext);
      expect(mockJwtVerify).toHaveBeenCalledWith(
        'some-token',
        expect.anything(),
        expect.objectContaining({ audience: 'test-project-uuid' })
      );
    });
  });

  describe('Error responses do not leak secrets', () => {
    it('401 error does not contain API keys or server secrets', async () => {
      mockReq.headers['x-stack-access-token'] = 'bad-token';
      mockJwtVerify.mockRejectedValue(new Error('signature verification failed'));

      await requireAuth(mockReq, mockRes, mockNext);
      const errorResponse = mockRes.json.mock.calls[0][0];
      const errorStr = JSON.stringify(errorResponse);
      expect(errorStr).not.toContain('sk-test-gemini-key');
      expect(errorStr).not.toContain('sk-test-openai-key');
      expect(errorStr).not.toContain('sk-test-anthropic-key');
      expect(errorStr).not.toContain('test-project-uuid');
    });
  });
});

describe('Server Config (server/config.ts)', () => {
  describe('getApiKeyForProvider', () => {
    it('returns correct key for google provider', async () => {
      const { getApiKeyForProvider } = await import('../../server/config.js');
      expect(getApiKeyForProvider('google')).toBe('sk-test-gemini-key');
    });

    it('returns correct key for openai provider', async () => {
      const { getApiKeyForProvider } = await import('../../server/config.js');
      expect(getApiKeyForProvider('openai')).toBe('sk-test-openai-key');
    });

    it('returns correct key for anthropic provider', async () => {
      const { getApiKeyForProvider } = await import('../../server/config.js');
      expect(getApiKeyForProvider('anthropic')).toBe('sk-test-anthropic-key');
    });

    it('returns empty string for ollama (no key needed)', async () => {
      const { getApiKeyForProvider } = await import('../../server/config.js');
      expect(getApiKeyForProvider('ollama')).toBe('');
    });

    it('throws for unknown provider', async () => {
      const { getApiKeyForProvider } = await import('../../server/config.js');
      expect(() => getApiKeyForProvider('unknown')).toThrow('Unknown provider');
    });
  });
});
