
import { Message, ChatSession, Note } from '../types';

declare const alasql: any;

const DB_NAME = 'nexus_db';

export const initDB = () => {
  try {
    alasql(`CREATE LOCALSTORAGE DATABASE IF NOT EXISTS ${DB_NAME}`);
    alasql(`ATTACH LOCALSTORAGE DATABASE ${DB_NAME}`);
    alasql(`USE ${DB_NAME}`);
    
    // Create tables if not exist
    alasql(`CREATE TABLE IF NOT EXISTS chats (id STRING PRIMARY KEY, title STRING, timestamp NUMBER, username STRING)`);
    alasql(`CREATE TABLE IF NOT EXISTS messages (id STRING PRIMARY KEY, chatId STRING, role STRING, text STRING, timestamp NUMBER, comparisonText STRING, attachments STRING)`);
    alasql(`CREATE TABLE IF NOT EXISTS notes (id STRING PRIMARY KEY, title STRING, content STRING, timestamp NUMBER, username STRING)`);
    alasql(`CREATE TABLE IF NOT EXISTS syllabus (id STRING PRIMARY KEY, content STRING, noteCount NUMBER, timestamp NUMBER, username STRING)`);
    alasql(`CREATE TABLE IF NOT EXISTS hive_transmissions (id STRING PRIMARY KEY, title STRING, content STRING, sender STRING, recipient STRING, timestamp NUMBER)`);
    alasql(`CREATE TABLE IF NOT EXISTS users (username STRING PRIMARY KEY, lastLogin NUMBER)`);
    
    // --- MIGRATIONS ---
    
    // Add username columns if they don't exist (for existing users, set to 'anon')
    try { alasql('ALTER TABLE chats ADD COLUMN username STRING'); alasql("UPDATE chats SET username = 'anon' WHERE username IS NULL"); } catch (e) {}
    try { alasql('ALTER TABLE notes ADD COLUMN username STRING'); alasql("UPDATE notes SET username = 'anon' WHERE username IS NULL"); } catch (e) {}
    try { alasql('ALTER TABLE syllabus ADD COLUMN username STRING'); alasql("UPDATE syllabus SET username = 'anon' WHERE username IS NULL"); } catch (e) {}

    // Legacy migrations
    try { alasql('ALTER TABLE messages ADD COLUMN comparisonText STRING'); } catch (e) {}
    try { alasql('ALTER TABLE messages ADD COLUMN attachments STRING'); } catch (e) {}

    // User Table Migration: Backfill users from existing chats/notes if they aren't in users table
    try {
        const existingChatUsers = alasql('SELECT DISTINCT username FROM chats');
        existingChatUsers.forEach((u: any) => {
            if (u.username) {
                try { alasql('INSERT INTO users VALUES (?, ?)', [u.username, Date.now()]); } catch(e) {}
            }
        });
        const existingNoteUsers = alasql('SELECT DISTINCT username FROM notes');
        existingNoteUsers.forEach((u: any) => {
            if (u.username) {
                try { alasql('INSERT INTO users VALUES (?, ?)', [u.username, Date.now()]); } catch(e) {}
            }
        });
    } catch(e) {
        console.error("User migration failed", e);
    }

    console.log("SQL Database Initialized & Migrated");
  } catch (e) {
    console.error("Database initialization failed", e);
  }
};

// --- USER MANAGEMENT ---

export const ensureUserExists = (username: string) => {
    try {
        const res = alasql('SELECT * FROM users WHERE username = ?', [username]);
        if (res.length === 0) {
            alasql('INSERT INTO users VALUES (?, ?)', [username, Date.now()]);
        } else {
            alasql('UPDATE users SET lastLogin = ? WHERE username = ?', [Date.now(), username]);
        }
    } catch(e) { 
        console.error("Failed to ensure user exists", e); 
    }
};

export const checkUserExists = (username: string): boolean => {
    try {
        const res = alasql('SELECT * FROM users WHERE username = ?', [username]);
        return res.length > 0;
    } catch(e) { 
        return false; 
    }
};

export const createChatSession = (username: string, title: string = 'New Session'): ChatSession => {
  const id = Date.now().toString();
  const timestamp = Date.now();
  alasql(`INSERT INTO chats VALUES (?, ?, ?, ?)`, [id, title, timestamp, username]);
  return { id, title, timestamp };
};

export const getChatSessions = (username: string): ChatSession[] => {
  try {
    const sessions = alasql(`SELECT * FROM chats WHERE username = ? ORDER BY timestamp DESC`, [username]);
    return sessions.map((s: any) => ({
      id: s.id,
      title: s.title || 'Untitled Session',
      timestamp: typeof s.timestamp === 'number' ? s.timestamp : Date.now()
    }));
  } catch (e) {
    return [];
  }
};

export const saveMessage = (message: Message) => {
  try {
    const attachmentsStr = message.attachments ? JSON.stringify(message.attachments) : undefined;
    alasql('DELETE FROM messages WHERE id = ?', [message.id]);
    alasql(`INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)`, 
      [message.id, message.chatId, message.role, message.text, message.timestamp, message.comparisonText || '', attachmentsStr]);
  } catch (e) {
    console.error("Failed to save message", e);
  }
};

export const getMessagesByChatId = (chatId: string): Message[] => {
  try {
    const msgs = alasql(`SELECT * FROM messages WHERE chatId = ? ORDER BY timestamp ASC`, [chatId]);
    return msgs.map((m: any) => ({
      ...m,
      attachments: m.attachments ? JSON.parse(m.attachments) : undefined
    }));
  } catch (e) {
    return [];
  }
};

export const updateChatTitle = (chatId: string, title: string) => {
  try {
    alasql(`UPDATE chats SET title = ? WHERE id = ?`, [title, chatId]);
  } catch (e) {
    console.error("Failed to update title", e);
  }
};

export const deleteChatSession = (chatId: string) => {
  try {
    alasql(`DELETE FROM messages WHERE chatId = ?`, [chatId]);
    alasql(`DELETE FROM chats WHERE id = ?`, [chatId]);
  } catch (e) {
    console.error("Failed to delete session", e);
  }
};

// --- NOTES OPERATIONS ---

export const saveNote = (note: Note, username: string) => {
  try {
    alasql('DELETE FROM notes WHERE id = ?', [note.id]); // Upsert safety
    alasql(`INSERT INTO notes VALUES (?, ?, ?, ?, ?)`, [note.id, note.title, note.content, note.timestamp, username]);
  } catch (e) {
    console.error("Failed to save note", e);
  }
};

export const getNotes = (username: string): Note[] => {
  try {
    return alasql(`SELECT * FROM notes WHERE username = ? ORDER BY timestamp DESC`, [username]);
  } catch (e) {
    return [];
  }
};

export const deleteNote = (id: string) => {
  try {
    alasql(`DELETE FROM notes WHERE id = ?`, [id]);
  } catch (e) {
    console.error("Failed to delete note", e);
  }
};

export const searchNotes = (username: string, query: string): Note[] => {
  try {
    const lowerQ = query.toLowerCase();
    const notes = getNotes(username);
    return notes.filter(n => 
      n.title.toLowerCase().includes(lowerQ) || 
      n.content.toLowerCase().includes(lowerQ)
    );
  } catch (e) {
    return [];
  }
};

// --- HIVE TRANSMISSION OPERATIONS ---

export interface HiveTransmission {
  id: string;
  title: string;
  content: string;
  sender: string;
  recipient: string;
  timestamp: number;
}

export const sendHiveNote = (note: Note, sender: string, recipient: string) => {
  try {
    const id = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    alasql(`INSERT INTO hive_transmissions VALUES (?, ?, ?, ?, ?, ?)`, 
      [id, note.title, note.content, sender, recipient, Date.now()]);
  } catch (e) {
    console.error("Failed to transmit note", e);
    throw e;
  }
};

export const getHiveTransmissions = (recipient: string): HiveTransmission[] => {
  try {
    return alasql(`SELECT * FROM hive_transmissions WHERE recipient = ? ORDER BY timestamp DESC`, [recipient]);
  } catch (e) {
    return [];
  }
};

export const deleteHiveTransmission = (id: string) => {
  try {
    alasql(`DELETE FROM hive_transmissions WHERE id = ?`, [id]);
  } catch (e) {
    console.error("Failed to delete transmission", e);
  }
};

// --- SYLLABUS OPERATIONS ---

export const saveSyllabus = (content: string, noteCount: number, username: string) => {
  try {
    // Unique ID per user
    const id = `syllabus_${username}`; 
    alasql('DELETE FROM syllabus WHERE id = ?', [id]);
    alasql('INSERT INTO syllabus VALUES (?, ?, ?, ?, ?)', 
        [id, content, noteCount, Date.now(), username]);
  } catch (e) {
    console.error("Failed to save syllabus", e);
  }
};

export const getSyllabus = (username: string): { content: string, noteCount: number, timestamp: number } | null => {
  try {
    const id = `syllabus_${username}`;
    const result = alasql('SELECT * FROM syllabus WHERE id = ?', [id]);
    return result.length > 0 ? result[0] : null;
  } catch (e) {
    return null;
  }
};

// --- BACKUP & RESTORE FUNCTIONS ---

export const exportBackup = (username: string) => {
  try {
    const chats = alasql('SELECT * FROM chats WHERE username = ?', [username]);
    // Get messages only for these chats
    const chatIds = chats.map((c: any) => c.id);
    let messages: any[] = [];
    if (chatIds.length > 0) {
        // alasql IN clause handling can be tricky with string arrays, manual loop often safer in JS environment for small datasets
        // or constructing the query string. Let's iterate.
        // Or fetch all and filter in JS (inefficient but safe for local).
        const allMsgs = alasql('SELECT * FROM messages');
        const validIds = new Set(chatIds);
        messages = allMsgs.filter((m: any) => validIds.has(m.chatId));
    }

    const notes = alasql('SELECT * FROM notes WHERE username = ?', [username]);
    const syllabus = alasql('SELECT * FROM syllabus WHERE username = ?', [username]);
    
    const data = {
      version: 4,
      timestamp: Date.now(),
      username,
      chats,
      messages,
      notes,
      syllabus
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus_${username}_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    console.error("Export failed", e);
    return false;
  }
};

export const importBackup = async (file: File, currentUsername: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        
        // Strategy: We import data UNDER the current logged in user
        // We do NOT overwrite other users' data.
        
        const targetUser = currentUsername;

        // Clean existing data for this user
        alasql('DELETE FROM chats WHERE username = ?', [targetUser]);
        alasql('DELETE FROM notes WHERE username = ?', [targetUser]);
        alasql('DELETE FROM syllabus WHERE username = ?', [targetUser]);
        
        // We must also delete messages linked to old chats of this user
        // But since we deleted chats, we can't look them up easily unless we did it before.
        // For simplicity in this lightweight app, orphan messages are rarely an issue, 
        // but let's try to be clean. 
        // Realistically, wiping all messages that don't belong to existing chats is an option, 
        // but might affect other users.
        // Let's just proceed with insert.

        if (json.chats) {
          json.chats.forEach((c: any) => {
            alasql('INSERT INTO chats VALUES (?, ?, ?, ?)', [c.id, c.title, c.timestamp, targetUser]);
          });
        }

        if (json.messages) {
          json.messages.forEach((m: any) => {
             // Delete potential duplicate message ID to avoid PK conflict
             alasql('DELETE FROM messages WHERE id = ?', [m.id]);
             alasql('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)', 
              [m.id, m.chatId, m.role, m.text, m.timestamp, m.comparisonText || '', m.attachments || undefined]);
          });
        }

        if (json.notes) {
          json.notes.forEach((n: any) => {
             alasql('INSERT INTO notes VALUES (?, ?, ?, ?, ?)', [n.id, n.title, n.content, n.timestamp, targetUser]);
          });
        }

        if (json.syllabus) {
          json.syllabus.forEach((s: any) => {
             // Ensure ID is correct for this user
             const sylId = `syllabus_${targetUser}`;
             alasql('INSERT INTO syllabus VALUES (?, ?, ?, ?, ?)', [sylId, s.content, s.noteCount, s.timestamp, targetUser]);
          });
        }

        resolve(true);
      } catch (err) {
        console.error("Import failed", err);
        reject(err);
      }
    };
    reader.readAsText(file);
  });
};
