import { vi } from 'vitest';

// Mock Stack Auth user object
export const createMockUser = (overrides: Record<string, any> = {}) => ({
  id: 'test-user-id-123',
  displayName: 'Test User',
  primaryEmail: 'test@example.com',
  signOut: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

// Mock useUser hook
export const mockUseUser = vi.fn(() => null);

// Mock useStackApp hook
export const mockUseStackApp = vi.fn(() => ({
  signInWithCredential: vi.fn(),
  signUpWithCredential: vi.fn(),
}));

// Mock StackClientApp
export const MockStackClientApp = vi.fn().mockImplementation(() => ({
  getUser: vi.fn().mockResolvedValue(null),
}));

// Mock StackProvider component
export const MockStackProvider = ({ children }: { children: React.ReactNode }) => children;

// Mock StackTheme component
export const MockStackTheme = ({ children }: { children: React.ReactNode }) => children;

// Mock SignIn component
export const MockSignIn = () => '<div data-testid="stack-sign-in">Sign In Form</div>';

// Mock UserButton component
export const MockUserButton = () => '<div data-testid="stack-user-button">User Button</div>';

// Module mock factory for @stackframe/stack
export const createStackAuthMock = () => ({
  useUser: mockUseUser,
  useStackApp: mockUseStackApp,
  StackClientApp: MockStackClientApp,
  StackProvider: MockStackProvider,
  StackTheme: MockStackTheme,
  SignIn: MockSignIn,
  UserButton: MockUserButton,
});
