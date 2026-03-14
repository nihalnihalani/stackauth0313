import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Ensure jose resolves to a single copy so vi.mock('jose') works
      // for both test code and server/middleware/auth.ts imports
      'jose': path.resolve(__dirname, 'node_modules/jose'),
    },
  },
});
