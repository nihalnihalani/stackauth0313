# Stack Auth Knowledge Brief for Nexus (Vite + React SPA)

## Project Context

- **App**: Nexus -- AI learning platform
- **Tech**: Vite + React 19 + TypeScript (NO backend server, NO Next.js)
- **Current Auth**: Simple localStorage username-only (no passwords, no tokens, no real security)
- **Port**: 3000 (Vite dev server)
- **Key Files**:
  - `index.tsx` -- React entry point with `QueryClientProvider`
  - `App.tsx` -- Root component, manages `user` state (string | null) from localStorage
  - `components/LoginScreen.tsx` -- Username-only input form
  - `components/ChatInterface.tsx` -- Main app UI, receives `username` string + `onLogout`
  - `services/dbService.ts` -- Local AlaSQL database, user table is just `{username, lastLogin}`
  - `vite.config.ts` -- Vite config on port 3000

---

## Which Stack Auth Features APPLY to This Project

### 1. Core Setup (StackClientApp + StackProvider + StackTheme)
- **Use `StackClientApp`** (NOT `StackServerApp` -- no backend server)
- Wrap the app in `<StackProvider>` and `<StackTheme>` in `index.tsx`
- `tokenStore` should be `"cookie"` for SPA (browser-managed)
- Package: `@stackframe/stack` (works for both Next.js and React)

### 2. Pre-built Components
| Stack Auth Component | Replaces | Notes |
|---------------------|----------|-------|
| `<SignIn />` | `LoginScreen.tsx` | Full sign-in form with OAuth + email/password + magic link |
| `<SignUp />` | (new) | Currently no sign-up flow exists |
| `<UserButton />` | Logout button in `ChatInterface.tsx` | Avatar dropdown with settings/sign-out |
| `<AccountSettings />` | (new) | Full profile/settings management |

### 3. React Hooks
| Hook | Usage |
|------|-------|
| `useUser()` | Replace `localStorage.getItem('nexus_user')` pattern. Returns full user object or null |
| `useUser({ or: 'redirect' })` | Auto-redirect unauthenticated users to sign-in |
| `useStackApp()` | Access the `StackClientApp` instance for programmatic actions |

### 4. Authentication Methods (all configurable in Stack dashboard)
- **OAuth**: Google, GitHub, etc. -- just enable in dashboard
- **Email/Password** (Credential sign-in)
- **Magic Link** (passwordless email)
- **Passkey** (WebAuthn)
- **Anonymous sign-up** -- could be useful for "try before sign up"

### 5. Custom Styling
- `<StackTheme>` accepts a theme object with color overrides
- Available variables: `background`, `foreground`, `primary`, `card`, `border`, etc.
- Supports dark mode out of the box
- For Nexus's black/white/cyan cyberpunk aesthetic, customize with:
  ```tsx
  const nexusTheme = {
    dark: {
      background: 'black',
      foreground: 'white',
      primary: '#22d3ee', // cyan-400
      primaryForeground: 'black',
      card: '#0a0a0a',
      cardForeground: 'white',
      border: 'rgba(255,255,255,0.2)',
    },
    radius: '2px', // Sharp edges for cyberpunk look
  };
  ```

### 6. Custom Pages
- Can use Stack Auth's `<SignIn />` component inside a custom layout
- Can go fully custom with `app.signInWithOAuth('google')` etc.
- Nexus could keep its cyberpunk login aesthetic while using Stack Auth's auth logic underneath

### 7. User Data
- `user.displayName` -- replaces the `username` string
- `user.primaryEmail` -- email address
- `user.id` -- unique user ID (replaces username as DB key)
- `user.clientMetadata` -- store app-specific user data (read/write from client)
- `user.signOut()` -- replaces `localStorage.removeItem('nexus_user')`

### 8. Internationalization (i18n)
- Pass `lang` prop to `<StackProvider>` for 13+ languages

### 9. Programmatic Auth Functions (via `useStackApp()`)
- `app.signInWithOAuth('google')` -- trigger OAuth flow
- `app.redirectToSignIn()` -- redirect to sign-in page
- `app.redirectToSignUp()` -- redirect to sign-up page

---

## Which Stack Auth Features DO NOT APPLY

### 1. Server Components & `StackServerApp`
- **Why**: No Next.js, no server-side rendering. This is a pure client-side Vite SPA.
- Everything using `await stackServerApp.getUser()`, `"use server"`, or server actions is NOT applicable.

### 2. Middleware-based Route Protection
- **Why**: No Next.js middleware. Route protection must be done client-side with `useUser({ or: 'redirect' })` or conditional rendering.

### 3. `StackHandler` / Catch-all Routes
- **Why**: `<StackHandler />` creates default auth pages at `/handler/[...stack]`. This is a Next.js App Router pattern. In Vite+React, you manually render `<SignIn />`, `<SignUp />` etc. in your own routes.

### 4. Server Metadata (`serverMetadata`)
- **Why**: Can only be read/written from server-side code. Without a backend, this is inaccessible. Use `clientMetadata` instead.

### 5. Server-only Operations
- Listing ALL users (`stackServerApp.listUsers()`)
- Creating users server-side
- Sending emails (`stackServerApp.sendEmail()`)
- Granting/revoking permissions server-side
- Webhook verification
- API key validation server-side
- These all require `StackServerApp` with a secret server key

### 6. Backend Integration (JWT Verification)
- **Why**: No backend to verify tokens against. If a backend is added later, JWT verification becomes applicable.

### 7. Supabase/Convex Integration
- **Why**: No backend database integration. Current DB is client-side AlaSQL/localStorage.

### 8. next-themes Integration
- **Why**: This is a Next.js package. For dark mode in Vite+React, use a different approach (CSS class toggle, or just default to dark since Nexus is always dark).

### 9. Payments (Stripe)
- **Why**: Requires server-side operations for secure checkout. Not applicable without a backend.

---

## Exact Setup Steps for Vite + React (Non-Next.js)

### Step 1: Install Package
```bash
npm install @stackframe/stack
```

### Step 2: Create Stack Auth Project
1. Go to https://app.stack-auth.com/projects
2. Create a new project
3. Enable desired auth methods (OAuth providers, email/password, etc.)
4. Copy the Project ID and Publishable Client Key

### Step 3: Environment Variables
Create `.env` in project root:
```env
VITE_STACK_PROJECT_ID=your-project-id
VITE_STACK_PUBLISHABLE_CLIENT_KEY=your-publishable-client-key
```

### Step 4: Create Stack Client App
Create `stack.ts` in project root:
```tsx
import { StackClientApp } from "@stackframe/stack";

export const stackClientApp = new StackClientApp({
  projectId: import.meta.env.VITE_STACK_PROJECT_ID,
  publishableClientKey: import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY,
  tokenStore: "cookie", // appropriate for SPA
});
```

### Step 5: Wrap App with Providers
Update `index.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { StackProvider, StackTheme } from "@stackframe/stack";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { stackClientApp } from './stack';
import App from './App';

const queryClient = new QueryClient({ ... });

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <StackProvider app={stackClientApp}>
        <StackTheme theme={nexusTheme}>
          <App />
        </StackTheme>
      </StackProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
```

### Step 6: Replace Auth Logic in App.tsx
```tsx
import { useUser } from "@stackframe/stack";

const App: React.FC = () => {
  const user = useUser();

  return (
    <div className="min-h-screen w-full bg-black text-white font-mono overflow-hidden">
      {user ? (
        <ChatInterface user={user} />
      ) : (
        <LoginScreen />
      )}
    </div>
  );
};
```

### Step 7: Update LoginScreen
Option A (Use Stack's pre-built `<SignIn />`):
```tsx
import { SignIn } from "@stackframe/stack";

const LoginScreen = () => (
  <div className="cyberpunk-wrapper">
    <SignIn />
  </div>
);
```

Option B (Custom UI with Stack's auth logic):
```tsx
import { useStackApp } from "@stackframe/stack";

const LoginScreen = () => {
  const app = useStackApp();
  return (
    <div className="cyberpunk-wrapper">
      <button onClick={() => app.signInWithOAuth('google')}>
        Sign In with Google
      </button>
      {/* Or use <CredentialSignIn /> for email/password */}
    </div>
  );
};
```

### Step 8: Update ChatInterface
- Change `username: string` prop to `user: CurrentUser` from Stack Auth
- Use `user.displayName` instead of raw username string
- Use `user.id` for database queries instead of username
- Replace `onLogout` with `user.signOut()` or `<UserButton />`

---

## Component Mapping: Current -> Stack Auth

| Current Code | Stack Auth Replacement |
|-------------|----------------------|
| `localStorage.getItem('nexus_user')` | `useUser()` hook |
| `localStorage.setItem('nexus_user', username)` | Handled by Stack Auth SDK automatically |
| `localStorage.removeItem('nexus_user')` | `user.signOut()` |
| `<LoginScreen onLogin={handleLogin} />` | `<SignIn />` or custom with `useStackApp()` |
| `username` string prop | `user.displayName` or `user.id` |
| `ensureUserExists(username)` in dbService | Stack Auth handles user creation automatically |
| Manual logout button | `<UserButton />` or `user.signOut()` |
| `config` stored in localStorage | Can optionally move to `user.clientMetadata` |

---

## API/Hook Reference for This Project

### Hooks (Client-side, all applicable)
| Hook | Returns | Use Case |
|------|---------|----------|
| `useUser()` | `CurrentUser \| null` | Check if logged in, get user data |
| `useUser({ or: 'redirect' })` | `CurrentUser` (guaranteed) | Protected pages, auto-redirect |
| `useStackApp()` | `StackClientApp` | Programmatic auth actions |

### User Object Properties (CurrentUser)
| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique user ID |
| `displayName` | `string \| null` | Display name |
| `primaryEmail` | `string \| null` | Primary email |
| `profileImageUrl` | `string \| null` | Avatar URL |
| `clientMetadata` | `Record<string, any>` | Custom app data (read/write) |
| `clientReadOnlyMetadata` | `Record<string, any>` | Server-set read-only data |
| `signedUpAtMillis` | `number` | Sign-up timestamp |

### User Object Methods
| Method | Description |
|--------|-------------|
| `user.update({ displayName, clientMetadata })` | Update user profile/metadata |
| `user.signOut()` | Sign out current user |
| `user.getAuthJson()` | Get access/refresh tokens (for backend calls) |
| `user.useConnectedAccount(provider)` | Get connected OAuth account |
| `user.useTeams()` | Get user's teams |

### StackClientApp Methods
| Method | Description |
|--------|-------------|
| `app.signInWithOAuth(provider)` | Start OAuth sign-in flow |
| `app.redirectToSignIn()` | Navigate to sign-in page |
| `app.redirectToSignUp()` | Navigate to sign-up page |

---

## Migration Impact Assessment

### Low-Impact Changes
- Adding `@stackframe/stack` dependency
- Creating `stack.ts` config file
- Wrapping app with `StackProvider`/`StackTheme`

### Medium-Impact Changes
- Replacing `LoginScreen` with Stack Auth components
- Changing `username: string` prop to Stack Auth `user` object throughout
- Updating `dbService.ts` to use `user.id` instead of username string

### High-Impact Changes
- All components that receive `username` as a prop need updating
- `ChatInterface`, `HistoryModal`, `NotesModal`, `SyllabusModal`, `HiveModal` all take `username` prop
- Database queries in `dbService.ts` use username as key -- need migration to user.id

### Data Migration Consideration
- Current data in AlaSQL/localStorage is keyed by username string
- Stack Auth uses unique user IDs (like `user_123456`)
- Will need a migration strategy for existing user data, or accept data loss for existing users
