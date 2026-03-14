import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Stack Auth Client Initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('T-COMP-01: StackClientApp configuration', () => {
    it('stack.ts configures StackClientApp with cookie tokenStore', async () => {
      // We test the configuration by reading the source and verifying the shape
      // rather than instantiating the real StackClientApp (which requires a valid UUID project ID)
      const { readFileSync } = await import('fs');
      const stackSource = readFileSync(
        '/Users/nihalnihalani/Desktop/Github/stackauth0313/stack.ts',
        'utf-8'
      );

      // Verify cookie-based token store (T-SEC-03: tokens not in localStorage)
      expect(stackSource).toContain('tokenStore: "cookie"');

      // Verify it reads from env vars
      expect(stackSource).toContain('import.meta.env.VITE_STACK_PROJECT_ID');
      expect(stackSource).toContain('import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY');
    });

    it('uses cookie tokenStore for secure session management (T-SEC-03)', async () => {
      const { readFileSync } = await import('fs');
      const stackSource = readFileSync(
        '/Users/nihalnihalani/Desktop/Github/stackauth0313/stack.ts',
        'utf-8'
      );

      // Tokens must be stored in cookies, NOT localStorage
      expect(stackSource).toContain('tokenStore: "cookie"');
      expect(stackSource).not.toContain('tokenStore: "localStorage"');
    });

    it('configures correct URL routing', async () => {
      const { readFileSync } = await import('fs');
      const stackSource = readFileSync(
        '/Users/nihalnihalani/Desktop/Github/stackauth0313/stack.ts',
        'utf-8'
      );

      // After sign-out, user should be redirected to sign-in
      expect(stackSource).toContain('afterSignOut: "/sign-in"');
      // After sign-in, user goes to root
      expect(stackSource).toContain('afterSignIn: "/"');
      // Sign-in and sign-up routes
      expect(stackSource).toContain('signIn: "/sign-in"');
      expect(stackSource).toContain('signUp: "/sign-up"');
    });
  });
});
