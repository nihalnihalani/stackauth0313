import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StackProvider, StackTheme } from '@stackframe/stack';
import { stackClientApp } from './stack';
import App from './App';
import { initDB } from './services/dbService';

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
    <div className="min-h-screen w-full bg-black text-white font-mono flex items-center justify-center">
      <div className="text-xs tracking-[0.3em] uppercase text-white/40 animate-pulse">
        Initializing Neural Link...
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
            background: '#000000',
            foreground: '#ffffff',
            primary: '#06b6d4',
            primaryForeground: '#000000',
            card: '#111111',
            cardForeground: '#ffffff',
          },
          radius: '2px',
        }}>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </StackTheme>
      </StackProvider>
    </Suspense>
  </React.StrictMode>
);
