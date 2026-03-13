import React from 'react';
import { SignIn } from '@stackframe/stack';

const AuthScreen: React.FC = () => {
  return (
    <div className="min-h-screen w-full bg-black text-white font-mono flex items-center justify-center relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md p-8 relative z-10">
        <div className="mb-8 text-center">
          <div className="inline-block border border-white/20 px-4 py-1 mb-6 bg-black">
            <span className="text-[10px] tracking-[0.3em] uppercase text-white/60">System_Access_Port</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-[0.2em] mb-2">NEXUS</h1>
          <p className="text-xs text-white/40 tracking-widest uppercase">Collaborative Cognitive Architecture</p>
        </div>

        {/* Stack Auth SignIn component - themed via StackTheme */}
        <SignIn />

        <div className="mt-8 flex justify-between text-[9px] text-white/20 uppercase tracking-widest select-none">
          <span>Secure_Protocol: Active</span>
          <span>Ver: 3.1.0</span>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
