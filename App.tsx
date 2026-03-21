import React, { useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import { ensureUserExists } from './services/dbService';

const DEFAULT_USER = 'local-user';
const DEFAULT_DISPLAY = 'Operator';

const App: React.FC = () => {
  useEffect(() => {
    ensureUserExists(DEFAULT_USER);
  }, []);

  return (
    <div className="min-h-screen w-full bg-[var(--surface)] text-[var(--on-surface)] font-body overflow-hidden">
      <ChatInterface
        username={DEFAULT_USER}
        displayName={DEFAULT_DISPLAY}
        onLogout={() => {}}
      />
    </div>
  );
};

export default App;
