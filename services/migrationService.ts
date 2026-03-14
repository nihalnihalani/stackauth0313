// Data migration service for transitioning from plain username strings to Stack Auth user IDs.
// This runs entirely client-side because all data lives in AlaSQL/localStorage.

declare const alasql: any;

export interface MigrationCheck {
  oldUsername: string;
  chatCount: number;
  noteCount: number;
  syllabusExists: boolean;
}

/**
 * Check if there is old data that needs migration.
 * Called on first Stack Auth login to detect data under the old username.
 * Returns migration info if data exists, null if no migration needed.
 */
export function checkForMigration(newUserId: string): MigrationCheck | null {
  try {
    const oldUsername = localStorage.getItem('nexus_user');

    // No old username stored, or it already matches the new ID
    if (!oldUsername || oldUsername === newUserId) {
      return null;
    }

    // Check if the old username actually has data
    const chatCount = alasql('SELECT COUNT(*) as c FROM chats WHERE username = ?', [oldUsername]);
    const noteCount = alasql('SELECT COUNT(*) as c FROM notes WHERE username = ?', [oldUsername]);
    const syllabusCheck = alasql('SELECT COUNT(*) as c FROM syllabus WHERE username = ?', [oldUsername]);

    const chats = chatCount[0]?.c || 0;
    const notes = noteCount[0]?.c || 0;
    const hasSyllabus = (syllabusCheck[0]?.c || 0) > 0;

    // No data under old username
    if (chats === 0 && notes === 0 && !hasSyllabus) {
      localStorage.removeItem('nexus_user');
      return null;
    }

    return {
      oldUsername,
      chatCount: chats,
      noteCount: notes,
      syllabusExists: hasSyllabus,
    };
  } catch (e) {
    console.error('Migration check failed:', e);
    return null;
  }
}

/**
 * Execute the data migration: update all records from oldUsername to newUserId.
 * This is a one-time operation that runs after the user confirms migration.
 */
export function executeMigration(oldUsername: string, newUserId: string): boolean {
  try {
    // Update chats table
    alasql('UPDATE chats SET username = ? WHERE username = ?', [newUserId, oldUsername]);

    // Update notes table
    alasql('UPDATE notes SET username = ? WHERE username = ?', [newUserId, oldUsername]);

    // Update syllabus table (both username column and composite ID)
    alasql('UPDATE syllabus SET username = ? WHERE username = ?', [newUserId, oldUsername]);
    const oldSyllabusId = `syllabus_${oldUsername}`;
    const newSyllabusId = `syllabus_${newUserId}`;
    alasql('UPDATE syllabus SET id = ? WHERE id = ?', [newSyllabusId, oldSyllabusId]);

    // Update users table
    alasql('UPDATE users SET username = ? WHERE username = ?', [newUserId, oldUsername]);

    // Update hive transmissions sender (recipient stays as-is since we
    // can't know the recipient's new user ID)
    alasql('UPDATE hive_transmissions SET sender = ? WHERE sender = ?', [newUserId, oldUsername]);

    // Clean up the old localStorage key
    localStorage.removeItem('nexus_user');

    // Mark migration as completed
    localStorage.setItem('nexus_migration_done', JSON.stringify({
      from: oldUsername,
      to: newUserId,
      timestamp: Date.now(),
    }));

    console.log(`Migration complete: ${oldUsername} -> ${newUserId}`);
    return true;
  } catch (e) {
    console.error('Migration failed:', e);
    return false;
  }
}

/**
 * Skip the migration without transferring data.
 * Just removes the old nexus_user key so the prompt doesn't show again.
 */
export function skipMigration(): void {
  localStorage.removeItem('nexus_user');
  localStorage.setItem('nexus_migration_skipped', Date.now().toString());
}

/**
 * Check if migration has already been completed or skipped.
 */
export function isMigrationHandled(): boolean {
  return (
    localStorage.getItem('nexus_migration_done') !== null ||
    localStorage.getItem('nexus_migration_skipped') !== null ||
    localStorage.getItem('nexus_user') === null
  );
}
