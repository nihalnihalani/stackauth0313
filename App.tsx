
import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import LoginScreen from './components/LoginScreen';
import { ensureUserExists } from './services/dbService';

const App: React.FC = () => {
  const [user, setUser] = useState<string | null>(() => {
    return localStorage.getItem('nexus_user');
  });

  const handleLogin = (username: string) => {
    ensureUserExists(username);
    localStorage.setItem('nexus_user', username);
    setUser(username);
  };

  const handleLogout = () => {
    localStorage.removeItem('nexus_user');
    setUser(null);
  };

  return (
    <div className="min-h-screen w-full bg-black text-white font-mono overflow-hidden">
      {user ? (
        <ChatInterface username={user} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;
