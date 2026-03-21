import React, { useEffect, useState } from 'react';
import { useUser } from '@stackframe/stack';
import ChatInterface from './components/ChatInterface';
import AuthScreen from './components/AuthScreen';
import MigrationPrompt from './components/MigrationPrompt';
import { ensureUserExists } from './services/dbService';
import { checkForMigration, MigrationCheck } from './services/migrationService';

const App: React.FC = () => {
  const user = useUser();
  const [migrationInfo, setMigrationInfo] = useState<MigrationCheck | null>(null);
  const [migrationChecked, setMigrationChecked] = useState(false);

  // When user logs in, ensure they exist in local DB and check for migration
  useEffect(() => {
    if (user) {
      ensureUserExists(user.id);

      // Check for legacy data migration on first login
      if (!migrationChecked) {
        const info = checkForMigration(user.id);
        if (info) {
          setMigrationInfo(info);
        }
        setMigrationChecked(true);
      }
    }
  }, [user, migrationChecked]);

  const handleLogout = async () => {
    if (user) {
      await user.signOut();
    }
  };

  const handleMigrationComplete = () => {
    setMigrationInfo(null);
  };

  return (
    <div className="min-h-screen w-full bg-[var(--surface)] text-[var(--on-surface)] font-body overflow-hidden">
      {user ? (
        <>
          {migrationInfo && (
            <MigrationPrompt
              migrationInfo={migrationInfo}
              newUserId={user.id}
              onComplete={handleMigrationComplete}
            />
          )}
          <ChatInterface
            username={user.id}
            displayName={user.displayName || user.primaryEmail || user.id}
            onLogout={handleLogout}
          />
        </>
      ) : (
        <AuthScreen />
      )}
    </div>
  );
};

export default App;
