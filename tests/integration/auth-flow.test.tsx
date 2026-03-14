import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';

const mockSignOut = vi.fn().mockResolvedValue(undefined);
let currentUser: any = null;

vi.mock('@stackframe/stack', () => ({
  useUser: () => currentUser,
  UserButton: () => <div data-testid="stack-user-button">UserBtn</div>,
  SignIn: () => <div data-testid="stack-sign-in">Sign In</div>,
  StackClientApp: vi.fn().mockImplementation(() => ({})),
  StackProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StackTheme: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../stack', () => ({
  stackClientApp: {},
}));

const mockEnsureUserExists = vi.fn<(username: string) => void>();
const mockGetChatSessions = vi.fn<(username: string) => any[]>(() => []);
const mockCreateChatSession = vi.fn<(username: string, title?: string) => any>(() => ({
  id: 'new-chat-1',
  title: 'New Session',
  timestamp: Date.now(),
}));

vi.mock('../../services/dbService', () => ({
  initDB: vi.fn(),
  ensureUserExists: (username: string) => mockEnsureUserExists(username),
  checkUserExists: vi.fn(() => true),
  createChatSession: (username: string, title?: string) => mockCreateChatSession(username, title),
  getChatSessions: (username: string) => mockGetChatSessions(username),
  saveMessage: vi.fn(),
  getMessagesByChatId: vi.fn(() => []),
  updateChatTitle: vi.fn(),
  deleteChatSession: vi.fn(),
  saveNote: vi.fn(),
  getNotes: vi.fn(() => []),
  deleteNote: vi.fn(),
  searchNotes: vi.fn(() => []),
  sendHiveNote: vi.fn(),
  getHiveTransmissions: vi.fn(() => []),
  deleteHiveTransmission: vi.fn(),
  saveSyllabus: vi.fn(),
  getSyllabus: vi.fn(() => null),
  exportBackup: vi.fn(() => true),
  importBackup: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../../services/llmService', () => ({
  streamResponse: vi.fn(),
  generateTitle: vi.fn(() => Promise.resolve('Test Title')),
  generateSyllabus: vi.fn(),
  generateAssessment: vi.fn(),
  processDocument: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn().mockImplementation(() => ({
    defaultOptions: {},
  })),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useQuery: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  })),
}));

import App from '../../App';

describe('Integration: Auth Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = null;
  });

  describe('T-AUTH-12 / T-AUTH-16: Sign-in -> ChatInterface -> Sign-out -> AuthScreen', () => {
    it('transitions from auth screen to chat when user signs in', () => {
      // Start unauthenticated
      const { rerender } = render(<App />);
      expect(screen.getByTestId('stack-sign-in')).toBeInTheDocument();

      // Simulate sign-in (useUser now returns a user)
      currentUser = {
        id: 'user-integration-test',
        displayName: 'Integration User',
        primaryEmail: 'integration@test.com',
        signOut: mockSignOut,
      };
      rerender(<App />);

      // Should now see ChatInterface (no sign-in form)
      expect(screen.queryByTestId('stack-sign-in')).not.toBeInTheDocument();
      expect(screen.getByText(/Integration User/)).toBeInTheDocument();
    });

    it('transitions from chat back to auth screen on sign-out', () => {
      // Start authenticated
      currentUser = {
        id: 'user-signout-test',
        displayName: 'Signout User',
        primaryEmail: 'signout@test.com',
        signOut: mockSignOut,
      };
      const { rerender } = render(<App />);
      expect(screen.queryByTestId('stack-sign-in')).not.toBeInTheDocument();

      // Simulate sign-out (useUser now returns null)
      currentUser = null;
      rerender(<App />);

      // Should see auth screen again
      expect(screen.getByTestId('stack-sign-in')).toBeInTheDocument();
    });
  });

  describe('T-EDGE-11: Old localStorage nexus_user does not bypass Stack Auth', () => {
    it('ignores stale nexus_user in localStorage', () => {
      // Set old-style auth in localStorage
      localStorage.setItem('nexus_user', 'old-username');

      // With Stack Auth returning null, user should NOT be authenticated
      currentUser = null;
      render(<App />);
      expect(screen.getByTestId('stack-sign-in')).toBeInTheDocument();
    });
  });

  describe('User data initialization on login', () => {
    it('calls ensureUserExists with the Stack Auth user.id', () => {
      currentUser = {
        id: 'auth-user-789',
        displayName: 'DB Init User',
        primaryEmail: 'dbinit@test.com',
        signOut: mockSignOut,
      };
      render(<App />);
      expect(mockEnsureUserExists).toHaveBeenCalledWith('auth-user-789');
    });

    it('loads existing chat sessions for the user on login', () => {
      mockGetChatSessions.mockReturnValue([
        { id: 'existing-chat', title: 'Previous Chat', timestamp: Date.now() },
      ]);
      currentUser = {
        id: 'returning-user',
        displayName: 'Returning User',
        primaryEmail: 'return@test.com',
        signOut: mockSignOut,
      };
      render(<App />);
      expect(mockGetChatSessions).toHaveBeenCalledWith('returning-user');
    });

    it('creates a new session if user has no existing chats', () => {
      mockGetChatSessions.mockReturnValue([]);
      currentUser = {
        id: 'new-user',
        displayName: 'New User',
        primaryEmail: 'new@test.com',
        signOut: mockSignOut,
      };
      render(<App />);
      expect(mockCreateChatSession).toHaveBeenCalledWith('new-user', undefined);
    });
  });
});
