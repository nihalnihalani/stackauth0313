import React from 'react';
import { SignIn } from '@stackframe/stack';

const AuthScreen: React.FC = () => {
  return (
    <div className="min-h-screen w-full bg-[var(--surface)] text-[var(--on-surface)] font-body flex items-center justify-center relative overflow-hidden">
      {/* Grid Overlay */}
      <div className="absolute inset-0 grid-overlay pointer-events-none"></div>
      {/* Ambient gradient */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[var(--surface-container-lowest)] via-[var(--surface-container-lowest)] to-[var(--primary-container)]/5 pointer-events-none"></div>

      <main className="relative z-20 w-full max-w-md px-6">
        {/* Header Branding */}
        <header className="mb-12 text-center">
          <h1 className="font-headline font-black text-[3.5rem] tracking-tighter text-[var(--primary-container)] drop-shadow-[0_0_40px_rgba(0,243,255,0.3)]">
            NEXUS
          </h1>
          <p className="label-sm text-[var(--on-surface-variant)] mt-2 border-t border-[var(--outline-variant)]/30 pt-2 inline-block">
            Collaborative Cognitive Architecture
          </p>
        </header>

        {/* Login Container */}
        <section className="bg-[var(--surface-container)] border border-[var(--primary-container)]/20 p-8 clipped-tr-bl shadow-[0px_10px_40px_rgba(0,243,255,0.05)] relative">
          {/* Corner Accents */}
          <div className="corner-accent-tr"></div>
          <div className="corner-accent-bl"></div>

          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-headline text-lg font-bold text-[var(--primary)] tracking-widest uppercase">
              Access_Protocol
            </h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[var(--tertiary-container)] animate-pulse"></span>
              <span className="label-sm text-[0.6rem] text-[var(--tertiary-container)]">SYS_READY</span>
            </div>
          </div>

          {/* Stack Auth SignIn component */}
          <div className="[&_button]:rounded-none [&_input]:rounded-none">
            <SignIn />
          </div>
        </section>

        {/* Protocol Footer Bar */}
        <div className="mt-6 space-y-2 px-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[var(--tertiary-container)] rounded-full animate-pulse"></span>
              <span className="label-sm text-[0.6rem] text-[var(--on-surface)] tracking-[0.2em]">
                SECURE_PROTOCOL: <span className="text-[var(--tertiary-container)]">ACTIVE</span>
              </span>
            </div>
            <span className="nexus-badge-success">V3.1.0-BETA</span>
          </div>
          <div className="flex justify-between label-sm text-[0.5rem] text-[var(--outline)] tracking-widest">
            <span>PORT: 3000</span>
            <span>ENCRYPTION: AES-256</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AuthScreen;
