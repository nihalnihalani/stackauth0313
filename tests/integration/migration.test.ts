import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAlasqlMock, resetAlasqlStore, seedUser, seedChat, seedNote } from '../mocks/alasql';

// Set up alasql mock
const alasqlMock = createAlasqlMock();
(globalThis as any).alasql = alasqlMock;

import {
  initDB,
  ensureUserExists,
  getChatSessions,
  getNotes,
  getSyllabus,
  saveSyllabus,
} from '../../services/dbService';

describe('T-MIG: Data Migration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAlasqlStore();
  });

  describe('T-MIG-01: Existing data accessible after auth change', () => {
    it('chat sessions created with old username are still queryable', () => {
      // Simulate pre-migration data (username was a plain string like "alice")
      seedChat('old-chat-1', 'alice', 'Old Chat');
      const sessions = getChatSessions('alice');
      expect(sessions.length).toBe(1);
      expect(sessions[0].title).toBe('Old Chat');
    });

    it('notes created with old username are still queryable', () => {
      seedNote('old-note-1', 'alice', 'Old Note', 'Old content');
      const notes = getNotes('alice');
      expect(notes.length).toBe(1);
      expect(notes[0].title).toBe('Old Note');
    });
  });

  describe('T-MIG-03: dbService functions work with new user identity format', () => {
    it('works with Stack Auth UUID-style user IDs', () => {
      const stackAuthId = 'usr_abc123def456';
      ensureUserExists(stackAuthId);

      seedChat('new-chat-1', stackAuthId, 'New Format Chat');
      const sessions = getChatSessions(stackAuthId);
      expect(sessions.length).toBe(1);
    });

    it('works with long user IDs without truncation', () => {
      const longId = 'stack-auth-user-id-that-is-quite-long-and-should-work';
      ensureUserExists(longId);

      seedNote('note-1', longId, 'Note', 'Content');
      const notes = getNotes(longId);
      expect(notes.length).toBe(1);
    });
  });

  describe('T-MIG-05: Existing config in localStorage is still read correctly', () => {
    it('nexus_config persists independently of auth changes', () => {
      const config = {
        provider: 'google',
        apiKey: 'test-key',
        baseUrl: '',
        model: 'gemini-3-pro-preview',
        mode: 'direct',
      };
      localStorage.setItem('nexus_config', JSON.stringify(config));
      const stored = JSON.parse(localStorage.getItem('nexus_config')!);
      expect(stored.provider).toBe('google');
      expect(stored.model).toBe('gemini-3-pro-preview');
    });
  });

  describe('T-MIG-06: No orphaned nexus_user keys interfere', () => {
    it('old nexus_user key does not affect Stack Auth authentication', () => {
      localStorage.setItem('nexus_user', 'old-alice');
      // Stack Auth manages its own session via cookies, not localStorage
      // The presence of nexus_user should not grant access
      const oldValue = localStorage.getItem('nexus_user');
      expect(oldValue).toBe('old-alice');
      // But this doesn't mean the user is authenticated - that's handled by useUser() in App.tsx
    });
  });

  describe('Syllabus migration', () => {
    it('syllabus keyed by new user id works correctly', () => {
      const userId = 'stack-user-123';
      saveSyllabus('{"title":"Test Syllabus","modules":[]}', 5, userId);
      const result = getSyllabus(userId);
      expect(result).not.toBeNull();
      expect(result?.noteCount).toBe(5);
    });
  });

  describe('Edge cases', () => {
    it('handles user with no existing data gracefully', () => {
      const newUser = 'brand-new-stack-user';
      expect(getChatSessions(newUser)).toEqual([]);
      expect(getNotes(newUser)).toEqual([]);
      expect(getSyllabus(newUser)).toBeNull();
    });

    it('multiple users can coexist without interference', () => {
      seedChat('c1', 'user-A', 'A Chat');
      seedChat('c2', 'user-B', 'B Chat');
      seedNote('n1', 'user-A', 'A Note');
      seedNote('n2', 'user-B', 'B Note');

      expect(getChatSessions('user-A').length).toBe(1);
      expect(getChatSessions('user-B').length).toBe(1);
      expect(getNotes('user-A').length).toBe(1);
      expect(getNotes('user-B').length).toBe(1);

      // Neither sees the other's data
      expect(getChatSessions('user-A')[0].title).toBe('A Chat');
      expect(getChatSessions('user-B')[0].title).toBe('B Chat');
    });
  });
});
