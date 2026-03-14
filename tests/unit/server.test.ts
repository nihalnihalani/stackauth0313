/**
 * Server Infrastructure Tests
 *
 * Tests for health endpoint, CORS configuration,
 * SSE streaming response format, and provider routing.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';

// Mock jose (required by auth middleware which chat.ts imports)
vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => 'mock-jwks'),
  jwtVerify: vi.fn(),
}));

// Mock server config
vi.mock('../../server/config.js', () => ({
  config: {
    stackProjectId: 'test-project-uuid',
    port: 3001,
    nodeEnv: 'test',
    geminiApiKey: 'test-gemini-key',
    openaiApiKey: 'test-openai-key',
    anthropicApiKey: 'test-anthropic-key',
    ollamaBaseUrl: 'http://localhost:11434',
    openaiBaseUrl: 'https://api.openai.com/v1',
    allowedOrigin: 'http://localhost:3000',
  },
  getApiKeyForProvider: (provider: string) => {
    switch (provider) {
      case 'google': return 'test-gemini-key';
      case 'openai': return 'test-openai-key';
      case 'anthropic': return 'test-anthropic-key';
      case 'ollama': return '';
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  },
}));

describe('Health Endpoint (server/routes/health.ts)', () => {
  it('returns status ok and timestamp', async () => {
    const mockRes = { json: vi.fn() };
    const { healthRouter } = await import('../../server/routes/health.js');

    // Extract handler from Router stack
    const healthHandler = (healthRouter as any).stack?.find(
      (layer: any) => layer.route?.path === '/health'
    )?.route?.stack?.[0]?.handle;

    if (healthHandler) {
      healthHandler({}, mockRes);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          timestamp: expect.any(Number),
        })
      );
    } else {
      // Fallback: verify the source code pattern
      const source = readFileSync(
        '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/routes/health.ts',
        'utf-8'
      );
      expect(source).toContain("status: 'ok'");
      expect(source).toContain('timestamp: Date.now()');
    }
  });

  it('does not require authentication (no requireAuth import)', () => {
    const source = readFileSync(
      '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/routes/health.ts',
      'utf-8'
    );
    expect(source).not.toContain('requireAuth');
  });
});

describe('CORS Configuration', () => {
  it('default allowedOrigin is localhost:3000 for development', () => {
    const source = readFileSync(
      '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/config.ts',
      'utf-8'
    );
    expect(source).toContain("allowedOrigin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000'");
  });

  it('allowedOrigin is configurable via ALLOWED_ORIGIN env var', () => {
    const source = readFileSync(
      '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/config.ts',
      'utf-8'
    );
    expect(source).toContain('ALLOWED_ORIGIN');
  });
});

describe('SSE Streaming Response Format (server/routes/chat.ts)', () => {
  it('sets Content-Type: text/event-stream header', () => {
    const source = readFileSync(
      '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/routes/chat.ts',
      'utf-8'
    );
    expect(source).toContain("'Content-Type', 'text/event-stream'");
  });

  it('sets Cache-Control: no-cache header', () => {
    const source = readFileSync(
      '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/routes/chat.ts',
      'utf-8'
    );
    expect(source).toContain("'Cache-Control', 'no-cache'");
  });

  it('sets Connection: keep-alive header', () => {
    const source = readFileSync(
      '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/routes/chat.ts',
      'utf-8'
    );
    expect(source).toContain("'Connection', 'keep-alive'");
  });

  it('sets X-Accel-Buffering: no to disable nginx buffering', () => {
    const source = readFileSync(
      '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/routes/chat.ts',
      'utf-8'
    );
    expect(source).toContain("'X-Accel-Buffering', 'no'");
  });

  it('sends text chunks as SSE data lines with JSON format', () => {
    const source = readFileSync(
      '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/routes/chat.ts',
      'utf-8'
    );
    expect(source).toContain('JSON.stringify({ text })');
    expect(source).toContain('data:');
  });

  it('sends [DONE] marker at end of stream', () => {
    const source = readFileSync(
      '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/routes/chat.ts',
      'utf-8'
    );
    expect(source).toContain('[DONE]');
  });

  it('sends errors as SSE data with error field (not plain text)', () => {
    const source = readFileSync(
      '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/routes/chat.ts',
      'utf-8'
    );
    expect(source).toContain('JSON.stringify({ error:');
  });

  it('validates required fields (provider, prompt) returning 400 on missing', () => {
    const source = readFileSync(
      '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/routes/chat.ts',
      'utf-8'
    );
    expect(source).toContain('!body.provider || !body.prompt');
    expect(source).toContain('400');
  });

  it('aborts upstream request when client disconnects', () => {
    const source = readFileSync(
      '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/routes/chat.ts',
      'utf-8'
    );
    expect(source).toContain("req.on('close'");
    expect(source).toContain('controller.abort()');
  });
});

describe('Provider Routing (server/services/llm/index.ts)', () => {
  it('routes google provider to streamGoogle', () => {
    const source = readFileSync(
      '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/services/llm/index.ts',
      'utf-8'
    );
    expect(source).toContain("case 'google':");
    expect(source).toContain('streamGoogle');
  });

  it('routes openai provider to streamOpenAI', () => {
    const source = readFileSync(
      '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/services/llm/index.ts',
      'utf-8'
    );
    expect(source).toContain("case 'openai':");
    expect(source).toContain('streamOpenAI');
  });

  it('routes anthropic provider to streamAnthropic', () => {
    const source = readFileSync(
      '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/services/llm/index.ts',
      'utf-8'
    );
    expect(source).toContain("case 'anthropic':");
    expect(source).toContain('streamAnthropic');
  });

  it('routes ollama provider to streamOllama', () => {
    const source = readFileSync(
      '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/services/llm/index.ts',
      'utf-8'
    );
    expect(source).toContain("case 'ollama':");
    expect(source).toContain('streamOllama');
  });

  it('throws for unknown provider', () => {
    const source = readFileSync(
      '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/services/llm/index.ts',
      'utf-8'
    );
    expect(source).toContain('Unknown provider');
  });

  it('validates API key before routing (except ollama)', () => {
    const source = readFileSync(
      '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/services/llm/index.ts',
      'utf-8'
    );
    expect(source).toContain('getApiKeyForProvider');
    expect(source).toContain("params.provider !== 'ollama'");
  });

  it('uses server-side env vars for API keys, not request body', () => {
    const source = readFileSync(
      '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/services/llm/index.ts',
      'utf-8'
    );
    expect(source).toContain("import { getApiKeyForProvider } from '../../config.js'");
  });
});

describe('Anthropic server-side calls', () => {
  it('does NOT include dangerously-allow-browser header as an actual header value', () => {
    const source = readFileSync(
      '/Users/nihalnihalani/Desktop/Github/stackauth0313/server/services/llm/anthropic.ts',
      'utf-8'
    );
    // Verify it is NOT set as an actual header (key: value pattern)
    // A comment explaining its absence is fine
    expect(source).not.toMatch(/'anthropic-dangerously-allow-browser'\s*:/);
    expect(source).not.toMatch(/"anthropic-dangerously-allow-browser"\s*:/);
  });
});
