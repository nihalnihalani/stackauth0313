# Stack Auth Integration Plan for Nexus

## Overview

Replace the current localStorage-based username-only authentication in Nexus with Stack Auth's React SDK. This gives us real authentication (OAuth, email/password, magic link), proper user identity, and a path to future features like teams, permissions, and payments.

**Key constraint**: Nexus is a **Vite + React 19** app (NO Next.js, NO backend server). All auth must happen client-side using `@stackframe/stack` with `StackClientApp`.

---

## 1. Package Installation

```bash
npm install @stackframe/stack
```

No other packages needed. Stack Auth's React SDK includes `StackProvider`, `StackTheme`, `StackHandler`, `SignIn`, `SignUp`, `UserButton`, `useUser`, `useStackApp`, and all pre-built components.

---

## 2. Environment Variables

Create a `.env` file (already gitignored via Vite defaults):

```env
VITE_STACK_PROJECT_ID=<your-project-id>
VITE_STACK_PUBLISHABLE_CLIENT_KEY=<your-publishable-client-key>
```

Update `vite.config.ts` to expose these (Vite automatically exposes `VITE_*` vars via `import.meta.env`). No changes to `vite.config.ts` needed for env vars since Vite handles `VITE_*` prefix natively.

**Note**: No secret server key is needed since we have no backend. The publishable client key is safe to expose in frontend code.

---

## 3. Stack Auth Dashboard Setup

Before writing any code:
1. Create an account at https://app.stack-auth.com
2. Create a new project (e.g., "Nexus")
3. Enable desired auth methods under "Auth Methods":
   - Email/Password (credential sign-in)
   - Magic Link (OTP)
   - OAuth providers (Google, GitHub, etc.) as desired
4. Copy the Project ID and Publishable Client Key to `.env`
5. Under "Domain & Handlers", add `localhost:3000` for development

---

## 4. File-by-File Changes

### 4.1 NEW FILE: `stack.ts` (Stack Client Configuration)

Create a new file at the project root to initialize the Stack client app:

```typescript
// stack.ts
import { StackClientApp } from "@stackframe/stack";

export const stackClientApp = new StackClientApp({
  projectId: import.meta.env.VITE_STACK_PROJECT_ID,
  publishableClientKey: import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY,
  tokenStore: "cookie", // Use cookies for token storage (works without Next.js)
  urls: {
    signIn: "/sign-in",
    signUp: "/sign-up",
    afterSignIn: "/",
    afterSignUp: "/",
    signOut: "/",
    afterSignOut: "/sign-in",
    handler: "/handler",
  },
});
```

**Why `tokenStore: "cookie"`**: For a client-only React app, `"cookie"` is the recommended store. It persists auth state across page reloads without a server. The SDK handles token refresh automatically.

### 4.2 MODIFY: `index.tsx` (Entry Point)

**Current** (`index.tsx`):
- Renders `<QueryClientProvider>` wrapping `<App />`
- Calls `initDB()` on startup

**Changes**:
- Import and wrap with `<StackProvider>` and `<StackTheme>`
- Add `<Suspense>` boundary (required for Stack Auth async hooks)
- Keep `QueryClientProvider` and `initDB()`

```typescript
// index.tsx
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

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Suspense fallback={<LoadingScreen />}>
      <StackProvider app={stackClientApp}>
        <StackTheme theme={{
          dark: {
            background: '#000000',
            foreground: '#ffffff',
            primary: '#06b6d4',        // cyan-500 to match Nexus theme
            primaryForeground: '#000000',
            card: '#111111',
            cardForeground: '#ffffff',
          },
          radius: '2px', // Sharp, terminal-like corners matching Nexus aesthetic
        }}>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </StackTheme>
      </StackProvider>
    </Suspense>
  </React.StrictMode>
);

function LoadingScreen() {
  return (
    <div className="min-h-screen w-full bg-black text-white font-mono flex items-center justify-center">
      <div className="text-xs tracking-[0.3em] uppercase text-white/40 animate-pulse">
        Initializing Neural Link...
      </div>
    </div>
  );
}
```

### 4.3 MODIFY: `App.tsx` (Core Auth Logic Replacement)

**Current flow**:
1. Reads `nexus_user` from localStorage
2. Shows `<LoginScreen>` if no user
3. Shows `<ChatInterface username={user}>` if user exists
4. `handleLogin` stores username in localStorage + calls `ensureUserExists`
5. `handleLogout` removes from localStorage

**New flow**:
1. Use `useUser()` from Stack Auth to get current user
2. If no user, show Stack Auth `<SignIn />` component (or redirect)
3. If user exists, show `<ChatInterface>` with Stack Auth user
4. Logout via `user.signOut()`
5. On first login, call `ensureUserExists()` with the Stack Auth user ID

```typescript
// App.tsx
import React, { useEffect } from 'react';
import { useUser, UserButton } from '@stackframe/stack';
import ChatInterface from './components/ChatInterface';
import AuthScreen from './components/AuthScreen';
import { ensureUserExists } from './services/dbService';

const App: React.FC = () => {
  const user = useUser();

  // When user logs in, ensure they exist in local DB
  useEffect(() => {
    if (user) {
      const userId = user.id;
      ensureUserExists(userId);
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
```

**Key decision**: We pass `user.id` (the Stack Auth UUID) as the `username` prop to `ChatInterface` and all downstream components. This is the stable, unique identifier for scoping data in AlaSQL. We also pass `displayName` separately for UI display.

### 4.4 NEW FILE: `components/AuthScreen.tsx` (Replaces LoginScreen)

Replace the custom username-only login with Stack Auth's pre-built components, styled to match Nexus's dark cyberpunk aesthetic:

```typescript
// components/AuthScreen.tsx
import React from 'react';
import { SignIn } from '@stackframe/stack';

const AuthScreen: React.FC = () => {
  return (
    <div className="min-h-screen w-full bg-black text-white font-mono flex items-center justify-center relative overflow-hidden">
      {/* Background Decor (same as old LoginScreen) */}
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
```

### 4.5 DELETE: `components/LoginScreen.tsx`

This file is fully replaced by `AuthScreen.tsx`. Remove it entirely.

### 4.6 MODIFY: `components/ChatInterface.tsx`

**Changes needed**:

1. **Props**: Add `displayName` prop alongside `username` (which is now the Stack Auth user ID)
2. **Status line**: Display `displayName` instead of raw user ID
3. **UserButton**: Replace the logout power-off icon with Stack Auth's `<UserButton />` component
4. **No other logic changes**: All data scoping already uses `username` param which we now set to `user.id`

```typescript
// ChatInterface.tsx changes:

// Props interface update:
interface ChatInterfaceProps {
  username: string;        // Stack Auth user ID (for data scoping)
  displayName: string;     // For display in UI
  onLogout: () => void;
}

// In the status line, change username to displayName:
// BEFORE: System_Ready // {username} // {config.mode}
// AFTER:  System_Ready // {displayName} // {config.mode}

// Replace logout button with UserButton:
// BEFORE: <button onClick={onLogout}><i className="fa-solid fa-power-off"></i></button>
// AFTER:  <UserButton /> (from @stackframe/stack, provides avatar, settings, logout)
```

### 4.7 MODIFY: `services/dbService.ts`

**Minimal changes needed**. The service already accepts `username: string` parameters everywhere. We simply change what gets passed in (Stack Auth user ID instead of a display name).

**One important migration concern**: Existing users have data stored under their old username (e.g., "john"). After integration, data will be stored under their Stack Auth user ID (e.g., "usr_abc123"). This means:

- **Existing data will NOT be automatically accessible** after the switch
- We need a **one-time migration path** (see Section 6)

No structural changes to `dbService.ts` are needed. The `username` column in all tables continues to work as a user identifier - it just stores a different value (Stack Auth ID vs. display name).

### 4.8 MODIFY: `components/NotesModal.tsx`

- The Hive "Transmit" feature currently sends notes to other users by username. After migration, the recipient identifier will be the Stack Auth user ID.
- **Option A**: Keep "transmit by username" but look up Stack Auth display names for UX (requires knowing other users' IDs).
- **Option B** (recommended): Replace Hive's manual username input with a simple ID-based approach. Since this is a local-only feature using AlaSQL (in-browser), it only works between browser tabs of the same user anyway. The Hive feature's utility is limited without a real backend.
- **No code changes required** for basic functionality - the `recipient` field in `sendHiveNote` already accepts any string identifier.

### 4.9 MODIFY: `components/HistoryModal.tsx`

No changes needed. Already receives `username` as a prop and passes it through to `dbService` functions.

### 4.10 MODIFY: `components/SyllabusModal.tsx`

No changes needed. Already receives `username` as a prop.

### 4.11 MODIFY: `components/HiveModal.tsx`

No changes needed. Already receives `username` as a prop.

### 4.12 MODIFY: `components/LiveInterface.tsx`

No changes needed. Receives `username` as a prop but only uses it for display, which we can update to use `displayName` if needed.

### 4.13 NO CHANGES: `services/llmService.ts`, `constants.ts`, `types.ts`

These files have no auth-related code.

### 4.14 MODIFY: `components/SettingsModal.tsx`

No auth changes needed. Optionally, we could add a link to Stack Auth's `<AccountSettings />` component, but this is not required for the initial integration.

### 4.15 NEW FILE: `handler.tsx` (Stack Auth Route Handler)

Stack Auth needs a route handler for OAuth callbacks, sign-out, etc. In a Vite app without a router, we handle this differently than Next.js.

**Option A (Simple)**: Use `<StackHandler />` at a specific path. But since Nexus has no client-side router (no React Router), we handle auth entirely through Stack Auth's popup/redirect flow.

**Option B (Recommended for Nexus)**: Since Nexus is a single-page app without routing, we rely on Stack Auth's built-in redirect mechanism. The `StackClientApp` configuration with `tokenStore: "cookie"` handles OAuth callbacks automatically. We do NOT need a separate handler page.

**If we add React Router later**, we would create a handler route. For now, no handler file is needed.

---

## 5. Auth Flow After Integration

### New Sign-In Flow
1. User visits app -> `useUser()` returns `null`
2. `<AuthScreen>` renders with Stack Auth's `<SignIn />` component
3. User signs in via email/password, magic link, or OAuth
4. Stack Auth SDK stores tokens in cookies, `useUser()` now returns user object
5. `App.tsx` `useEffect` calls `ensureUserExists(user.id)` to create/update local DB record
6. `<ChatInterface>` renders with `username={user.id}` and `displayName={user.displayName}`

### New Sign-Out Flow
1. User clicks `<UserButton />` -> "Sign Out"
2. Stack Auth SDK clears tokens
3. `useUser()` returns `null`
4. App re-renders showing `<AuthScreen>`

### Token Management
- Stack Auth SDK handles token refresh automatically (10-minute JWT lifetime, auto-refreshed)
- Tokens stored in cookies (persist across page reloads)
- No manual token management needed

---

## 6. Migration Strategy for Existing Data

### The Problem
Existing users have data stored under their display name (e.g., `username = "john"`). After Stack Auth integration, data is stored under their Stack Auth user ID (e.g., `username = "usr_abc123"`). Old data becomes orphaned.

### Recommended Approach: One-Time Migration Prompt

Add a migration utility that runs once after a user's first Stack Auth login:

1. After first login, check if there's data under the old localStorage `nexus_user` value
2. If yes, show a migration prompt: "We found existing data under username 'john'. Would you like to import it into your new account?"
3. If user accepts, update all records in `chats`, `notes`, `syllabus`, `hive_transmissions` tables to replace old username with the new Stack Auth user ID
4. Remove the old `nexus_user` localStorage key
5. If user declines, just clear the old localStorage key

```typescript
// Migration logic (in App.tsx useEffect or a new migration service)
const migrateExistingData = (newUserId: string) => {
  const oldUsername = localStorage.getItem('nexus_user');
  if (!oldUsername || oldUsername === newUserId) return null;

  // Check if old username has data
  const oldChats = alasql('SELECT COUNT(*) as c FROM chats WHERE username = ?', [oldUsername]);
  const oldNotes = alasql('SELECT COUNT(*) as c FROM notes WHERE username = ?', [oldUsername]);

  if (oldChats[0].c === 0 && oldNotes[0].c === 0) {
    localStorage.removeItem('nexus_user');
    return null;
  }

  return { oldUsername, chatCount: oldChats[0].c, noteCount: oldNotes[0].c };
};

const executeMigration = (oldUsername: string, newUserId: string) => {
  alasql('UPDATE chats SET username = ? WHERE username = ?', [newUserId, oldUsername]);
  alasql('UPDATE notes SET username = ? WHERE username = ?', [newUserId, oldUsername]);
  alasql('UPDATE syllabus SET username = ? WHERE username = ?', [newUserId, oldUsername]);
  alasql('UPDATE users SET username = ? WHERE username = ?', [newUserId, oldUsername]);
  localStorage.removeItem('nexus_user');
};
```

### Alternative: Fresh Start
If migration complexity is not worth it (this is a dev/demo app), simply remove the old `nexus_user` localStorage key on first Stack Auth login. Users start fresh with a new account. This is the simplest approach.

---

## 7. What Happens to Existing Features

| Feature | Impact | Action Needed |
|---------|--------|---------------|
| Chat sessions | Data scoped by username -> now by user ID | Migration or fresh start |
| Notes | Data scoped by username -> now by user ID | Migration or fresh start |
| Syllabus | Data scoped by username -> now by user ID | Migration or fresh start |
| Hive (transmit) | Uses username for recipient | Works as-is (uses string identifier) |
| History (backup/restore) | Exports data by username | Works as-is (scoped by whatever username is) |
| Settings (config) | Stored in localStorage as `nexus_config` | No change - not user-scoped |
| LLM Service | No auth dependency | No change |
| Live Audio | Uses username for display | Pass displayName instead |
| Assessments | No auth dependency | No change |

---

## 8. Implementation Order

1. **Install package**: `npm install @stackframe/stack`
2. **Create `.env`** with Stack Auth project ID and publishable key
3. **Create `stack.ts`** with StackClientApp configuration
4. **Update `index.tsx`** to wrap with StackProvider + StackTheme + Suspense
5. **Create `components/AuthScreen.tsx`** with SignIn component
6. **Update `App.tsx`** to use `useUser()` hook and new auth flow
7. **Update `ChatInterface.tsx`** to accept displayName prop and use UserButton
8. **Delete `components/LoginScreen.tsx`**
9. **Add data migration** (optional - prompt to migrate old data)
10. **Test**: Sign up, sign in, sign out, data persistence, OAuth flows

---

## 9. Risks and Considerations

1. **No React Router**: Nexus has no client-side router. Stack Auth's OAuth flow uses redirects. The `StackClientApp` with `tokenStore: "cookie"` should handle this, but we need to verify that OAuth callback redirects work correctly without a router. If not, we may need to add a minimal React Router setup or use popup-based OAuth.

2. **AlaSQL + User IDs**: Stack Auth user IDs are UUIDs (e.g., `usr_abc123`). AlaSQL stores these as STRING PRIMARY KEYs, which is fine. No schema changes needed.

3. **Import Maps in index.html**: The current `index.html` uses import maps pointing to CDN URLs. The `@stackframe/stack` package needs to be bundled by Vite, not loaded from CDN. This should work fine since Vite handles npm packages through its bundler, but we should verify there are no conflicts with the import map.

4. **React 19 Compatibility**: Nexus uses React 19.2.1. Stack Auth SDK should be compatible, but we should verify this during implementation.

5. **Dark Mode / Theming**: Stack Auth components have their own styling. We use `StackTheme` with dark mode colors matching Nexus's black/white/cyan aesthetic. The `<SignIn />` component may need CSS overrides if the theme customization isn't sufficient.

6. **No SSR**: Since Nexus is a pure client-side app (no SSR), all Stack Auth operations are client-side. We use `StackClientApp`, not `StackServerApp`. This means:
   - No server-side user management
   - No secret server key needed
   - All auth verification happens client-side via the SDK
   - This is appropriate for a learning platform with local-only data

---

## 10. Summary of Changes

| Action | File | Type |
|--------|------|------|
| CREATE | `stack.ts` | New - Stack client config |
| CREATE | `components/AuthScreen.tsx` | New - Replaces LoginScreen |
| CREATE | `.env` | New - Environment variables |
| MODIFY | `index.tsx` | Wrap with StackProvider/StackTheme/Suspense |
| MODIFY | `App.tsx` | Replace localStorage auth with useUser() |
| MODIFY | `components/ChatInterface.tsx` | Add displayName prop, use UserButton |
| DELETE | `components/LoginScreen.tsx` | Replaced by AuthScreen |
| NO CHANGE | `services/dbService.ts` | Username param works as-is |
| NO CHANGE | `services/llmService.ts` | No auth dependency |
| NO CHANGE | `types.ts` | No auth types needed |
| NO CHANGE | `constants.ts` | No auth constants |
| NO CHANGE | All other components | Receive username as prop, no changes |
