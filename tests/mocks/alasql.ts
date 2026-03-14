import { vi } from 'vitest';

// In-memory store to simulate alasql behavior
interface TableStore {
  [tableName: string]: Record<string, any>[];
}

const store: TableStore = {
  users: [],
  chats: [],
  messages: [],
  notes: [],
  syllabus: [],
  hive_transmissions: [],
};

// Reset store between tests
export const resetAlasqlStore = () => {
  Object.keys(store).forEach((key) => {
    store[key] = [];
  });
};

// Seed data for testing
export const seedUser = (username: string) => {
  store.users.push({ username, lastLogin: Date.now() });
};

export const seedChat = (id: string, username: string, title = 'Test Chat') => {
  store.chats.push({ id, title, timestamp: Date.now(), username });
};

export const seedNote = (id: string, username: string, title = 'Test Note', content = 'Test content') => {
  store.notes.push({ id, title, content, timestamp: Date.now(), username });
};

export const seedMessage = (id: string, chatId: string, role: string, text: string) => {
  store.messages.push({ id, chatId, role, text, timestamp: Date.now(), comparisonText: '', attachments: undefined });
};

// Simple query parser for common patterns used in dbService
export const createAlasqlMock = () => {
  return vi.fn((query: string, params?: any[]) => {
    const q = query.trim().toUpperCase();

    // CREATE statements - no-op
    if (q.startsWith('CREATE')) return [];

    // ATTACH / USE - no-op
    if (q.startsWith('ATTACH') || q.startsWith('USE')) return [];

    // ALTER - no-op (migrations)
    if (q.startsWith('ALTER')) return [];

    // SELECT queries
    if (q.startsWith('SELECT')) {
      if (q.includes('FROM USERS')) {
        if (params && params.length > 0) {
          return store.users.filter((u) => u.username === params[0]);
        }
        return store.users;
      }
      if (q.includes('FROM CHATS')) {
        if (params && params.length > 0) {
          return store.chats
            .filter((c) => c.username === params[0])
            .sort((a, b) => b.timestamp - a.timestamp);
        }
        return store.chats;
      }
      if (q.includes('FROM MESSAGES')) {
        if (params && params.length > 0) {
          return store.messages
            .filter((m) => m.chatId === params[0])
            .sort((a, b) => a.timestamp - b.timestamp);
        }
        return store.messages;
      }
      if (q.includes('FROM NOTES')) {
        if (params && params.length > 0) {
          return store.notes
            .filter((n) => n.username === params[0])
            .sort((a, b) => b.timestamp - a.timestamp);
        }
        return store.notes;
      }
      if (q.includes('FROM SYLLABUS')) {
        if (params && params.length > 0) {
          return store.syllabus.filter((s) => s.id === params[0]);
        }
        return store.syllabus;
      }
      if (q.includes('FROM HIVE_TRANSMISSIONS')) {
        if (params && params.length > 0) {
          return store.hive_transmissions
            .filter((h) => h.recipient === params[0])
            .sort((a, b) => b.timestamp - a.timestamp);
        }
        return store.hive_transmissions;
      }
      return [];
    }

    // INSERT queries
    if (q.startsWith('INSERT')) {
      if (q.includes('INTO USERS') && params) {
        store.users.push({ username: params[0], lastLogin: params[1] });
      } else if (q.includes('INTO CHATS') && params) {
        store.chats.push({ id: params[0], title: params[1], timestamp: params[2], username: params[3] });
      } else if (q.includes('INTO MESSAGES') && params) {
        store.messages.push({
          id: params[0],
          chatId: params[1],
          role: params[2],
          text: params[3],
          timestamp: params[4],
          comparisonText: params[5],
          attachments: params[6],
        });
      } else if (q.includes('INTO NOTES') && params) {
        store.notes.push({ id: params[0], title: params[1], content: params[2], timestamp: params[3], username: params[4] });
      } else if (q.includes('INTO SYLLABUS') && params) {
        store.syllabus.push({ id: params[0], content: params[1], noteCount: params[2], timestamp: params[3], username: params[4] });
      } else if (q.includes('INTO HIVE_TRANSMISSIONS') && params) {
        store.hive_transmissions.push({
          id: params[0],
          title: params[1],
          content: params[2],
          sender: params[3],
          recipient: params[4],
          timestamp: params[5],
        });
      }
      return [];
    }

    // DELETE queries
    if (q.startsWith('DELETE')) {
      if (q.includes('FROM USERS') && params) {
        store.users = store.users.filter((u) => u.username !== params[0]);
      } else if (q.includes('FROM CHATS')) {
        if (q.includes('WHERE USERNAME') && params) {
          store.chats = store.chats.filter((c) => c.username !== params[0]);
        } else if (params) {
          store.chats = store.chats.filter((c) => c.id !== params[0]);
        }
      } else if (q.includes('FROM MESSAGES') && params) {
        store.messages = store.messages.filter((m) => {
          if (q.includes('CHATID')) return m.chatId !== params[0];
          return m.id !== params[0];
        });
      } else if (q.includes('FROM NOTES')) {
        if (q.includes('WHERE USERNAME') && params) {
          store.notes = store.notes.filter((n) => n.username !== params[0]);
        } else if (params) {
          store.notes = store.notes.filter((n) => n.id !== params[0]);
        }
      } else if (q.includes('FROM SYLLABUS')) {
        if (q.includes('WHERE USERNAME') && params) {
          store.syllabus = store.syllabus.filter((s) => s.username !== params[0]);
        } else if (params) {
          store.syllabus = store.syllabus.filter((s) => s.id !== params[0]);
        }
      } else if (q.includes('FROM HIVE_TRANSMISSIONS') && params) {
        store.hive_transmissions = store.hive_transmissions.filter((h) => h.id !== params[0]);
      }
      return [];
    }

    // UPDATE queries
    if (q.startsWith('UPDATE')) {
      if (q.includes('USERS') && params) {
        store.users = store.users.map((u) =>
          u.username === params[1] ? { ...u, lastLogin: params[0] } : u
        );
      } else if (q.includes('CHATS') && params) {
        store.chats = store.chats.map((c) =>
          c.id === params[1] ? { ...c, title: params[0] } : c
        );
      }
      return [];
    }

    return [];
  });
};
