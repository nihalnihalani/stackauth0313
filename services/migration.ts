/**
 * Data Migration Service
 *
 * Migrates existing AlaSQL data from plain-text username keys
 * to Stack Auth user.id UUIDs on first authenticated login.
 */

declare const alasql: (sql: string, params?: unknown[]) => unknown[];

export interface MigrationResult {
  success: boolean;
  migratedFrom: string;
  migratedTo: string;
  counts: {
    chats: number;
    notes: number;
    syllabus: number;
    hiveTransmissions: number;
  };
  errors: string[];
}

const MIGRATION_KEY_PREFIX = 'nexus_migration_';

/**
 * Check if a user.id has already completed migration
 */
export const hasMigrated = (userId: string): boolean => {
  try {
    return localStorage.getItem(`${MIGRATION_KEY_PREFIX}${userId}`) === 'true';
  } catch {
    return false;
  }
};

/**
 * Mark migration as complete for a user.id
 */
const markMigrated = (userId: string): void => {
  localStorage.setItem(`${MIGRATION_KEY_PREFIX}${userId}`, 'true');
};

/**
 * Get all distinct usernames that have data in the local DB
 * (excluding UUIDs that look like Stack Auth IDs)
 */
export const getOldUsernames = (): string[] => {
  try {
    const chatUsers = alasql('SELECT DISTINCT username FROM chats') as Array<{ username: string }>;
    const noteUsers = alasql('SELECT DISTINCT username FROM notes') as Array<{ username: string }>;
    const syllabusUsers = alasql('SELECT DISTINCT username FROM syllabus') as Array<{ username: string }>;

    const allUsernames = new Set<string>();
    [...chatUsers, ...noteUsers, ...syllabusUsers].forEach(row => {
      if (row.username && !isUUID(row.username)) {
        allUsernames.add(row.username);
      }
    });

    return Array.from(allUsernames);
  } catch {
    return [];
  }
};

/**
 * Simple UUID v4 pattern check to distinguish old usernames from Stack Auth IDs
 */
const isUUID = (str: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

/**
 * Count data owned by a specific username
 */
export const countUserData = (username: string): { chats: number; notes: number; syllabus: number } => {
  try {
    const chats = alasql('SELECT COUNT(*) AS cnt FROM chats WHERE username = ?', [username]) as Array<{ cnt: number }>;
    const notes = alasql('SELECT COUNT(*) AS cnt FROM notes WHERE username = ?', [username]) as Array<{ cnt: number }>;
    const syllabus = alasql('SELECT COUNT(*) AS cnt FROM syllabus WHERE username = ?', [username]) as Array<{ cnt: number }>;

    return {
      chats: chats[0]?.cnt ?? 0,
      notes: notes[0]?.cnt ?? 0,
      syllabus: syllabus[0]?.cnt ?? 0,
    };
  } catch {
    return { chats: 0, notes: 0, syllabus: 0 };
  }
};

/**
 * Migrate all data from an old username to a new Stack Auth user.id
 *
 * This updates the `username` column in all relevant tables.
 * Messages don't have a username column (they're linked via chatId),
 * so they follow automatically.
 */
export const migrateUserData = (oldUsername: string, newUserId: string): MigrationResult => {
  const result: MigrationResult = {
    success: false,
    migratedFrom: oldUsername,
    migratedTo: newUserId,
    counts: { chats: 0, notes: 0, syllabus: 0, hiveTransmissions: 0 },
    errors: [],
  };

  // Take a snapshot before migration for rollback
  let chatSnapshot: unknown[] = [];
  let noteSnapshot: unknown[] = [];
  let syllabusSnapshot: unknown[] = [];
  let hiveSnapshot: unknown[] = [];

  try {
    chatSnapshot = alasql('SELECT * FROM chats WHERE username = ?', [oldUsername]);
    noteSnapshot = alasql('SELECT * FROM notes WHERE username = ?', [oldUsername]);
    syllabusSnapshot = alasql('SELECT * FROM syllabus WHERE username = ?', [oldUsername]);
    hiveSnapshot = alasql(
      'SELECT * FROM hive_transmissions WHERE sender = ? OR recipient = ?',
      [oldUsername, oldUsername]
    );
  } catch (e) {
    result.errors.push(`Snapshot failed: ${String(e)}`);
    return result;
  }

  try {
    // 1. Migrate chats
    const chatResult = alasql(
      'UPDATE chats SET username = ? WHERE username = ?',
      [newUserId, oldUsername]
    ) as unknown as number;
    result.counts.chats = typeof chatResult === 'number' ? chatResult : chatSnapshot.length;

    // 2. Migrate notes
    const noteResult = alasql(
      'UPDATE notes SET username = ? WHERE username = ?',
      [newUserId, oldUsername]
    ) as unknown as number;
    result.counts.notes = typeof noteResult === 'number' ? noteResult : noteSnapshot.length;

    // 3. Migrate syllabus (also needs ID update since ID is `syllabus_${username}`)
    const oldSyllabusId = `syllabus_${oldUsername}`;
    const newSyllabusId = `syllabus_${newUserId}`;
    const syllabusRows = alasql('SELECT * FROM syllabus WHERE id = ?', [oldSyllabusId]) as Array<{
      id: string; content: string; noteCount: number; timestamp: number; username: string;
    }>;

    if (syllabusRows.length > 0) {
      const syl = syllabusRows[0];
      alasql('DELETE FROM syllabus WHERE id = ?', [oldSyllabusId]);
      alasql('INSERT INTO syllabus VALUES (?, ?, ?, ?, ?)', [
        newSyllabusId, syl.content, syl.noteCount, syl.timestamp, newUserId,
      ]);
      result.counts.syllabus = 1;
    }

    // 4. Migrate hive transmissions (update both sender and recipient references)
    const hiveSenderResult = alasql(
      'UPDATE hive_transmissions SET sender = ? WHERE sender = ?',
      [newUserId, oldUsername]
    ) as unknown as number;
    const hiveRecipientResult = alasql(
      'UPDATE hive_transmissions SET recipient = ? WHERE recipient = ?',
      [newUserId, oldUsername]
    ) as unknown as number;
    result.counts.hiveTransmissions =
      (typeof hiveSenderResult === 'number' ? hiveSenderResult : 0) +
      (typeof hiveRecipientResult === 'number' ? hiveRecipientResult : 0);

    // 5. Update users table
    try {
      alasql('DELETE FROM users WHERE username = ?', [oldUsername]);
    } catch {
      // Old user entry might not exist
    }

    // Mark migration complete
    markMigrated(newUserId);
    result.success = true;
  } catch (e) {
    result.errors.push(`Migration failed: ${String(e)}`);

    // Attempt rollback
    try {
      rollbackMigration(chatSnapshot, noteSnapshot, syllabusSnapshot, hiveSnapshot, oldUsername);
      result.errors.push('Rollback completed successfully');
    } catch (rollbackErr) {
      result.errors.push(`Rollback also failed: ${String(rollbackErr)}`);
    }
  }

  return result;
};

/**
 * Rollback migration by restoring snapshots
 */
const rollbackMigration = (
  chats: unknown[],
  notes: unknown[],
  syllabus: unknown[],
  hive: unknown[],
  oldUsername: string
): void => {
  // Restore chats
  chats.forEach((c: unknown) => {
    const chat = c as { id: string; title: string; timestamp: number; username: string };
    alasql('DELETE FROM chats WHERE id = ?', [chat.id]);
    alasql('INSERT INTO chats VALUES (?, ?, ?, ?)', [
      chat.id, chat.title, chat.timestamp, oldUsername,
    ]);
  });

  // Restore notes
  notes.forEach((n: unknown) => {
    const note = n as { id: string; title: string; content: string; timestamp: number; username: string };
    alasql('DELETE FROM notes WHERE id = ?', [note.id]);
    alasql('INSERT INTO notes VALUES (?, ?, ?, ?, ?)', [
      note.id, note.title, note.content, note.timestamp, oldUsername,
    ]);
  });

  // Restore syllabus
  syllabus.forEach((s: unknown) => {
    const syl = s as { id: string; content: string; noteCount: number; timestamp: number; username: string };
    alasql('DELETE FROM syllabus WHERE id = ?', [syl.id]);
    alasql('INSERT INTO syllabus VALUES (?, ?, ?, ?, ?)', [
      syl.id, syl.content, syl.noteCount, syl.timestamp, oldUsername,
    ]);
  });

  // Restore hive transmissions
  hive.forEach((h: unknown) => {
    const tx = h as { id: string; title: string; content: string; sender: string; recipient: string; timestamp: number };
    alasql('DELETE FROM hive_transmissions WHERE id = ?', [tx.id]);
    alasql('INSERT INTO hive_transmissions VALUES (?, ?, ?, ?, ?, ?)', [
      tx.id, tx.title, tx.content, tx.sender, tx.recipient, tx.timestamp,
    ]);
  });
};

/**
 * Check if migration is needed for a newly authenticated user.
 * Returns the list of old usernames that have claimable data,
 * or empty array if no migration is needed.
 */
export const checkMigrationNeeded = (userId: string): string[] => {
  if (hasMigrated(userId)) {
    return [];
  }

  return getOldUsernames();
};
