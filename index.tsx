import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StackProvider, StackTheme } from '@stackframe/stack';
import { stackClientApp } from './stack';
import App from './App';
import { initDB } from './services/dbService';
import './nexus-design.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Initialize DB once at startup
if (typeof window !== 'undefined') {
  initDB();
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    },
  },
});

function LoadingScreen() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: 'var(--surface, #131313)' }}>
      <div className="absolute inset-0 scanline pointer-events-none opacity-20" />
      <div className="flex flex-col items-center gap-4 z-10">
        <div className="font-headline text-2xl font-black tracking-tighter" style={{ color: 'var(--primary-container, #00F3FF)', textShadow: '0 0 15px rgba(0,243,255,0.4)' }}>
          NEXUS
        </div>
        <div className="font-headline text-[0.6875rem] tracking-[0.3em] uppercase animate-pulse" style={{ color: 'var(--on-surface-variant, #b9cacb)' }}>
          Initializing Secure Protocol...
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Suspense fallback={<LoadingScreen />}>
      <StackProvider app={stackClientApp}>
        <StackTheme theme={{
          dark: {
            background: '#131313',
            foreground: '#e5e2e1',
            primary: '#00F3FF',
            primaryForeground: '#00373a',
            card: '#201f1f',
            cardForeground: '#e5e2e1',
          },
          radius: '0px',
        }}>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </StackTheme>
      </StackProvider>
    </Suspense>
  </React.StrictMode>
);
