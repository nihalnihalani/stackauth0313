import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock alasql global
const alasqlMock = vi.fn(() => []);
(globalThis as any).alasql = alasqlMock;

// Mock import.meta.env
(globalThis as any).import = {
  meta: {
    env: {
      VITE_STACK_PROJECT_ID: 'test-project-id',
      VITE_STACK_PUBLISHABLE_CLIENT_KEY: 'test-publishable-key',
    },
  },
};

// Mock process.env for LLM service
(globalThis as any).process = {
  ...(globalThis as any).process,
  env: {
    API_KEY: 'test-api-key',
    GEMINI_API_KEY: 'test-gemini-key',
  },
};
