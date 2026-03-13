
import React, { useState } from 'react';

interface LoginScreenProps {
  onLogin: (username: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      onLogin(username.trim());
    }
  };

  return (
    <div className="min-h-screen w-full bg-black text-white font-mono flex items-center justify-center relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md p-8 relative z-10 animate-in fade-in slide-in-bottom duration-700">
        <div className="mb-12 text-center">
          <div className="inline-block border border-white/20 px-4 py-1 mb-6 bg-black">
             <span className="text-[10px] tracking-[0.3em] uppercase text-white/60">System_Access_Port</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-[0.2em] mb-2">NEXUS</h1>
          <p className="text-xs text-white/40 tracking-widest uppercase">Collaborative Cognitive Architecture</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-white/50 block pl-1">Identify User</label>
            <div className="relative group">
               <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-white/50 rounded-sm opacity-30 group-hover:opacity-100 transition duration-500 blur-sm"></div>
               <input
                 type="text"
                 value={username}
                 onChange={(e) => setUsername(e.target.value)}
                 className="relative w-full bg-black border border-white/20 text-white p-4 text-center text-lg tracking-wider focus:border-cyan-400 outline-none rounded-sm placeholder:text-white/10 uppercase"
                 placeholder="USERNAME"
                 autoFocus
               />
            </div>
          </div>

          <button
            type="submit"
            disabled={!username.trim()}
            className="w-full bg-white text-black font-bold uppercase tracking-[0.2em] py-4 hover:bg-cyan-400 transition-all disabled:opacity-50 disabled:hover:bg-white relative overflow-hidden group"
          >
             <span className="relative z-10 group-hover:tracking-[0.4em] transition-all duration-300">Initialize Connection</span>
          </button>
        </form>

        <div className="mt-12 flex justify-between text-[9px] text-white/20 uppercase tracking-widest select-none">
           <span>Secure_Protocol: Active</span>
           <span>Ver: 3.1.0</span>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
