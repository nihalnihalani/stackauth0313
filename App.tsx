import React, { useEffect } from 'react';
import { useUser } from '@stackframe/stack';
import ChatInterface from './components/ChatInterface';
import AuthScreen from './components/AuthScreen';
import { ensureUserExists } from './services/dbService';

const App: React.FC = () => {
  const user = useUser();

  // When user logs in, ensure they exist in local DB
  useEffect(() => {
    if (user) {
      ensureUserExists(user.id);
    }
  }, [user]);

  const handleLogout = async () => {
    if (user) {
      await user.signOut();
    }
  };

  return (
    <div className="min-h-screen w-full bg-black text-white font-mono overflow-hidden">
      {user ? (
        <ChatInterface
          username={user.id}
          displayName={user.displayName || user.primaryEmail || user.id}
          onLogout={handleLogout}
        />
      ) : (
        <AuthScreen />
      )}
    </div>
  );
};

export default App;
