import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAlasqlMock, resetAlasqlStore, seedUser, seedChat, seedNote, seedMessage } from '../mocks/alasql';

// Set up alasql mock before importing dbService
const alasqlMock = createAlasqlMock();
(globalThis as any).alasql = alasqlMock;

import {
  initDB,
  ensureUserExists,
  checkUserExists,
  createChatSession,
  getChatSessions,
  saveMessage,
  getMessagesByChatId,
  updateChatTitle,
  deleteChatSession,
  saveNote,
  getNotes,
  deleteNote,
  searchNotes,
  sendHiveNote,
  getHiveTransmissions,
  deleteHiveTransmission,
  saveSyllabus,
  getSyllabus,
} from '../../services/dbService';

describe('dbService - Database Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAlasqlStore();
  });

  describe('initDB', () => {
    it('creates database and tables without throwing', () => {
      expect(() => initDB()).not.toThrow();
    });

    it('calls alasql to create tables', () => {
      initDB();
      expect(alasqlMock).toHaveBeenCalled();
    });
  });

  describe('T-USER-04: User management uses Stack Auth user.id', () => {
    it('ensureUserExists creates a new user with given id', () => {
      ensureUserExists('stack-auth-uid-001');
      const users = alasqlMock('SELECT * FROM users');
      expect(users).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ username: 'stack-auth-uid-001' }),
        ])
      );
    });

    it('ensureUserExists updates lastLogin for existing user', () => {
      seedUser('stack-auth-uid-002');
      ensureUserExists('stack-auth-uid-002');
      // Should have called UPDATE
      expect(alasqlMock).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.arrayContaining(['stack-auth-uid-002'])
      );
    });

    it('checkUserExists returns true for existing user', () => {
      seedUser('existing-user');
      expect(checkUserExists('existing-user')).toBe(true);
    });

    it('checkUserExists returns false for non-existent user', () => {
      expect(checkUserExists('nonexistent')).toBe(false);
    });
  });

  describe('T-DATA-01: Chat sessions stored with Stack Auth user ID', () => {
    it('createChatSession associates session with user id', () => {
      const session = createChatSession('uid-abc');
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('title', 'New Session');
      // Verify INSERT was called with the user id
      expect(alasqlMock).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chats'),
        expect.arrayContaining(['uid-abc'])
      );
    });

    it('getChatSessions returns only sessions for specified user', () => {
      seedChat('chat-1', 'user-A', 'Chat A');
      seedChat('chat-2', 'user-B', 'Chat B');
      const sessions = getChatSessions('user-A');
      expect(sessions.length).toBe(1);
      expect(sessions[0].title).toBe('Chat A');
    });

    it('getChatSessions returns empty array for user with no chats', () => {
      expect(getChatSessions('no-chats-user')).toEqual([]);
    });
  });

  describe('T-DATA-02: Notes stored with Stack Auth user ID', () => {
    it('saveNote stores note with user id', () => {
      const note = { id: 'note-1', title: 'Test', content: 'Content', timestamp: Date.now() };
      saveNote(note, 'uid-xyz');
      expect(alasqlMock).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notes'),
        expect.arrayContaining(['uid-xyz'])
      );
    });

    it('getNotes returns only notes for the specified user', () => {
      seedNote('n1', 'user-A', 'Note A', 'Content A');
      seedNote('n2', 'user-B', 'Note B', 'Content B');
      const notes = getNotes('user-A');
      expect(notes.length).toBe(1);
      expect(notes[0].title).toBe('Note A');
    });
  });

  describe('T-DATA-05: Data isolation between users', () => {
    it('user A cannot see user B chats', () => {
      seedChat('c1', 'user-A');
      seedChat('c2', 'user-B');
      expect(getChatSessions('user-A').length).toBe(1);
      expect(getChatSessions('user-B').length).toBe(1);
    });

    it('user A cannot see user B notes', () => {
      seedNote('n1', 'user-A');
      seedNote('n2', 'user-B');
      expect(getNotes('user-A').length).toBe(1);
      expect(getNotes('user-B').length).toBe(1);
    });

    it('user A cannot see user B hive transmissions', () => {
      // Hive transmissions are filtered by recipient
      const transmissions = getHiveTransmissions('user-A');
      expect(transmissions.length).toBe(0);
    });
  });

  describe('Message operations', () => {
    it('saveMessage stores a message', () => {
      saveMessage({
        id: 'msg-1',
        chatId: 'chat-1',
        role: 'user',
        text: 'Hello',
        timestamp: Date.now(),
      });
      expect(alasqlMock).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO messages'),
        expect.any(Array)
      );
    });

    it('getMessagesByChatId returns messages for chat', () => {
      seedMessage('m1', 'chat-1', 'user', 'Hello');
      seedMessage('m2', 'chat-1', 'model', 'Hi there');
      seedMessage('m3', 'chat-2', 'user', 'Different chat');
      const msgs = getMessagesByChatId('chat-1');
      expect(msgs.length).toBe(2);
    });
  });

  describe('Note search', () => {
    it('searchNotes finds notes by title', () => {
      seedNote('n1', 'user-A', 'React Hooks', 'Content about hooks');
      seedNote('n2', 'user-A', 'TypeScript', 'Content about TS');
      const results = searchNotes('user-A', 'react');
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('React Hooks');
    });

    it('searchNotes finds notes by content', () => {
      seedNote('n1', 'user-A', 'Title', 'Content about machine learning');
      const results = searchNotes('user-A', 'machine');
      expect(results.length).toBe(1);
    });

    it('searchNotes returns empty for no match', () => {
      seedNote('n1', 'user-A', 'Title', 'Content');
      const results = searchNotes('user-A', 'nonexistent-query');
      expect(results.length).toBe(0);
    });
  });

  describe('Hive transmissions', () => {
    it('sendHiveNote creates a transmission', () => {
      const note = { id: 'n1', title: 'Shared Note', content: 'Content', timestamp: Date.now() };
      sendHiveNote(note, 'sender-id', 'recipient-id');
      expect(alasqlMock).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO hive_transmissions'),
        expect.any(Array)
      );
    });

    it('getHiveTransmissions filters by recipient', () => {
      const note = { id: 'n1', title: 'Test', content: 'Content', timestamp: Date.now() };
      sendHiveNote(note, 'user-A', 'user-B');
      const forB = getHiveTransmissions('user-B');
      expect(forB.length).toBe(1);
      const forA = getHiveTransmissions('user-A');
      expect(forA.length).toBe(0);
    });

    it('deleteHiveTransmission removes transmission', () => {
      const note = { id: 'n1', title: 'Test', content: 'Content', timestamp: Date.now() };
      sendHiveNote(note, 'user-A', 'user-B');
      const transmissions = getHiveTransmissions('user-B');
      expect(transmissions.length).toBe(1);
      deleteHiveTransmission(transmissions[0].id);
      expect(getHiveTransmissions('user-B').length).toBe(0);
    });
  });

  describe('Syllabus operations', () => {
    it('saveSyllabus stores syllabus with user id', () => {
      saveSyllabus('{"title":"Test"}', 5, 'user-A');
      expect(alasqlMock).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO syllabus'),
        expect.arrayContaining(['user-A'])
      );
    });

    it('getSyllabus returns syllabus for user', () => {
      saveSyllabus('{"title":"Test Syllabus"}', 3, 'user-A');
      const result = getSyllabus('user-A');
      expect(result).not.toBeNull();
      expect(result?.content).toBe('{"title":"Test Syllabus"}');
      expect(result?.noteCount).toBe(3);
    });

    it('getSyllabus returns null for user with no syllabus', () => {
      expect(getSyllabus('no-syllabus-user')).toBeNull();
    });
  });

  describe('Chat session management', () => {
    it('updateChatTitle updates the title', () => {
      seedChat('chat-1', 'user-A', 'Old Title');
      updateChatTitle('chat-1', 'New Title');
      expect(alasqlMock).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE chats'),
        ['New Title', 'chat-1']
      );
    });

    it('deleteChatSession removes chat and its messages', () => {
      seedChat('chat-1', 'user-A');
      seedMessage('m1', 'chat-1', 'user', 'Hello');
      deleteChatSession('chat-1');
      expect(alasqlMock).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM messages'),
        ['chat-1']
      );
      expect(alasqlMock).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM chats'),
        ['chat-1']
      );
    });

    it('deleteNote removes a note', () => {
      seedNote('n1', 'user-A');
      deleteNote('n1');
      expect(alasqlMock).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM notes'),
        ['n1']
      );
    });
  });
});
