import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock @stackframe/stack before importing components
const mockSignOut = vi.fn().mockResolvedValue(undefined);
const mockUseUser = vi.fn();

vi.mock('@stackframe/stack', () => ({
  useUser: () => mockUseUser(),
  UserButton: () => <div data-testid="stack-user-button">UserBtn</div>,
  SignIn: () => <div data-testid="stack-sign-in">Sign In Form</div>,
  StackClientApp: vi.fn().mockImplementation(() => ({})),
  StackProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StackTheme: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock stack.ts module
vi.mock('../../stack', () => ({
  stackClientApp: {},
}));

// Mock dbService
vi.mock('../../services/dbService', () => ({
  initDB: vi.fn(),
  ensureUserExists: vi.fn(),
  checkUserExists: vi.fn(() => true),
  createChatSession: vi.fn(() => ({ id: 'test-chat-1', title: 'New Session', timestamp: Date.now() })),
  getChatSessions: vi.fn(() => []),
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

// Mock llmService
vi.mock('../../services/llmService', () => ({
  streamResponse: vi.fn(),
  generateTitle: vi.fn(() => Promise.resolve('Test Title')),
  generateSyllabus: vi.fn(),
  generateAssessment: vi.fn(),
  processDocument: vi.fn(),
}));

// Import the mocked module so we can reference it in tests
import { ensureUserExists } from '../../services/dbService';

// Mock @tanstack/react-query
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
import AuthScreen from '../../components/AuthScreen';

describe('Auth - Stack Auth Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('T-COMP-02: App shows AuthScreen when user is not authenticated', () => {
    it('renders AuthScreen when useUser returns null', () => {
      mockUseUser.mockReturnValue(null);
      render(<App />);
      expect(screen.getByTestId('stack-sign-in')).toBeInTheDocument();
    });
  });

  describe('T-COMP-03: App shows ChatInterface when user is authenticated', () => {
    it('renders ChatInterface when useUser returns a user object', () => {
      mockUseUser.mockReturnValue({
        id: 'user-abc-123',
        displayName: 'Alice',
        primaryEmail: 'alice@test.com',
        signOut: mockSignOut,
      });
      render(<App />);
      // ChatInterface renders the status bar with displayName
      expect(screen.queryByTestId('stack-sign-in')).not.toBeInTheDocument();
    });
  });

  describe('T-USER-03: displayName is shown in the UI', () => {
    it('passes displayName to ChatInterface for display', () => {
      mockUseUser.mockReturnValue({
        id: 'user-abc-123',
        displayName: 'Alice',
        primaryEmail: 'alice@test.com',
        signOut: mockSignOut,
      });
      render(<App />);
      // The status bar contains the displayName
      expect(screen.getByText(/Alice/)).toBeInTheDocument();
    });

    it('falls back to primaryEmail when displayName is null', () => {
      mockUseUser.mockReturnValue({
        id: 'user-abc-123',
        displayName: null,
        primaryEmail: 'alice@test.com',
        signOut: mockSignOut,
      });
      render(<App />);
      expect(screen.getByText(/alice@test.com/)).toBeInTheDocument();
    });

    it('falls back to user id when both displayName and primaryEmail are null', () => {
      mockUseUser.mockReturnValue({
        id: 'user-abc-123',
        displayName: null,
        primaryEmail: null,
        signOut: mockSignOut,
      });
      render(<App />);
      expect(screen.getByText(/user-abc-123/)).toBeInTheDocument();
    });
  });

  describe('T-USER-04: user.id is used for DB operations', () => {
    it('calls ensureUserExists with user.id on login', () => {
      mockUseUser.mockReturnValue({
        id: 'stack-auth-user-id',
        displayName: 'Bob',
        primaryEmail: 'bob@test.com',
        signOut: mockSignOut,
      });
      render(<App />);
      expect(ensureUserExists).toHaveBeenCalledWith('stack-auth-user-id');
    });
  });

  describe('T-COMP-04: App passes user identity to ChatInterface', () => {
    it('passes user.id as username prop and displayName as displayName prop', () => {
      mockUseUser.mockReturnValue({
        id: 'uid-456',
        displayName: 'Charlie',
        primaryEmail: 'charlie@test.com',
        signOut: mockSignOut,
      });
      render(<App />);
      // ChatInterface uses username (user.id) internally, displayName for UI
      // Verify displayName shows up in the rendered output
      expect(screen.getByText(/Charlie/)).toBeInTheDocument();
    });
  });
});

describe('AuthScreen Component', () => {
  describe('T-AUTH-01: Auth screen renders SignIn component', () => {
    it('renders Stack Auth SignIn component', () => {
      render(<AuthScreen />);
      expect(screen.getByTestId('stack-sign-in')).toBeInTheDocument();
    });

    it('renders NEXUS branding', () => {
      render(<AuthScreen />);
      expect(screen.getByText('NEXUS')).toBeInTheDocument();
    });

    it('renders system access label', () => {
      render(<AuthScreen />);
      expect(screen.getByText('System_Access_Port')).toBeInTheDocument();
    });
  });
});
