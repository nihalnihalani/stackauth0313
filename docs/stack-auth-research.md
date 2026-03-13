# Stack Auth SDK Research for Nexus

## Research Summary

This document captures comprehensive findings from the Stack Auth documentation for integrating auth into Nexus (React + Vite + TypeScript). It covers both client-side (already partially implemented) and server-side (new backend) integration patterns.

---

## 1. Current Client-Side Implementation (Validated)

### What Nexus Has Now

**`stack.ts`** - StackClientApp initialization:
```typescript
import { StackClientApp } from "@stackframe/stack";

export const stackClientApp = new StackClientApp({
  projectId: import.meta.env.VITE_STACK_PROJECT_ID,
  publishableClientKey: import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY,
  tokenStore: "cookie",  // Correct for SPAs
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

**Validation**: This is correct per Stack Auth docs. Key points:
- `tokenStore: "cookie"` is the right choice for SPAs (stores access + refresh tokens in cookies)
- `projectId` and `publishableClientKey` are client-safe (prefixed `pck_`)
- The `urls` configuration controls redirect behavior

**`App.tsx`** - useUser() hook:
```typescript
const user = useUser();  // Returns CurrentUser | null
```

**Validation**: Correct usage. `useUser()` is an alias for `useStackApp().useUser()`. Returns `null` if not signed in.

**`AuthScreen.tsx`** - SignIn component:
```typescript
import { SignIn } from '@stackframe/stack';
<SignIn />
```

**Validation**: Correct. The `<SignIn />` component renders the full sign-in form with configurable tabs (password, magic-link). Props available: `fullPage`, `automaticRedirect`, `firstTab`, `extraInfo`.

**`index.tsx`** - Provider setup:
```typescript
<StackProvider app={stackClientApp}>
  <StackTheme theme={{...}}>
    {children}
  </StackTheme>
</StackProvider>
```

**Validation**: Correct. `StackProvider` requires the `app` prop (StackClientApp or StackServerApp). `StackTheme` is optional for styling.

### CurrentUser Object Shape (from useUser())

```typescript
type CurrentUser = {
  id: string;                        // UUID - Stack Auth user ID
  displayName: string | null;
  primaryEmail: string | null;
  primaryEmailVerified: boolean;
  profileImageUrl: string | null;
  signedUpAt: Date;
  hasPassword: boolean;
  clientMetadata: Json;              // Read/write from client
  clientReadOnlyMetadata: Json;      // Read from client, write from server
  selectedTeam: Team | null;

  update(data): Promise<void>;
  updatePassword(data): Promise<void>;
  getAuthHeaders(): Promise<Record<string, string>>;
  getAuthJson(): Promise<{ accessToken: string | null }>;
  signOut([options]): Promise<void>;
  delete(): Promise<void>;
};
```

**Key method for backend integration**: `user.getAuthJson()` returns `{ accessToken }` which is the JWT to send to the backend.

---

## 2. StackServerApp for Node.js Backend

### Important: No StackServerApp SDK for Non-Next.js

Stack Auth's `@stackframe/stack` SDK is designed primarily for Next.js. For a standalone Node.js/Express backend, **do NOT use `StackServerApp` directly**. Instead, use the **REST API** with proper headers.

### Server-Side Authentication via REST API

Two approaches for validating user tokens on the backend:

#### Approach A: JWT Verification (Recommended - Fast, No Network Calls)

```typescript
// server/middleware/auth.ts
import * as jose from 'jose';

const STACK_PROJECT_ID = process.env.STACK_PROJECT_ID!;

// Cache JWKS - refresh periodically (jose handles this automatically)
const jwks = jose.createRemoteJWKSet(
  new URL(`https://api.stack-auth.com/api/v1/projects/${STACK_PROJECT_ID}/.well-known/jwks.json`)
);

export async function verifyAccessToken(accessToken: string): Promise<jose.JWTPayload> {
  const { payload } = await jose.jwtVerify(accessToken, jwks);
  return payload;
  // payload.sub = user ID
  // payload.email = user email
  // payload.name = display name
  // payload.email_verified = boolean
  // payload.is_anonymous = boolean
  // payload.is_restricted = boolean
}
```

**JWT Claims Available** (no API call needed):
```json
{
  "iss": "https://api.stack-auth.com/api/v1/projects/<project-id>",
  "sub": "user_123456",           // User ID
  "aud": "<project-id>",
  "exp": 1735689600,
  "iat": 1735603200,
  "project_id": "<project-id>",
  "branch_id": "main",
  "role": "authenticated",
  "name": "John Doe",             // Display name (nullable)
  "email": "john@example.com",    // Email (nullable)
  "email_verified": true,
  "is_anonymous": false,
  "is_restricted": false
}
```

**Pros**: Fast (no network call), works offline once JWKS cached
**Cons**: Limited user info (only what's in JWT), can't get metadata

#### Approach B: REST API Verification (Full User Data)

```typescript
// server/middleware/auth.ts
export async function getUserFromToken(accessToken: string) {
  const response = await fetch('https://api.stack-auth.com/api/v1/users/me', {
    headers: {
      'x-stack-access-type': 'server',
      'x-stack-project-id': process.env.STACK_PROJECT_ID!,
      'x-stack-secret-server-key': process.env.STACK_SECRET_SERVER_KEY!,
      'x-stack-access-token': accessToken,
    },
  });

  if (response.status === 200) {
    return await response.json();
  }
  return null;
}
```

**Full User Response** from REST API:
```json
{
  "id": "3241a285-8329-4d69-8f3d-316e08cf140c",
  "primary_email": "johndoe@example.com",
  "primary_email_verified": true,
  "display_name": "John Doe",
  "profile_image_url": "https://...",
  "signed_up_at_millis": 1630000000000,
  "client_metadata": {},
  "client_read_only_metadata": {},
  "server_metadata": {},
  "is_anonymous": false,
  "is_restricted": false
}
```

**Pros**: Full user data including all metadata
**Cons**: Network call to Stack Auth on every request (adds latency)

### Recommendation for Nexus

**Use JWT verification (Approach A) for the auth middleware** - it's faster and sufficient for our use case. We only need the user ID (`sub` claim) to:
1. Gate access to the LLM proxy
2. Associate requests with a user for rate limiting

We don't need full user profile data on the backend.

---

## 3. Protecting Backend API Routes

### Express Middleware Pattern

```typescript
// server/middleware/requireAuth.ts
import * as jose from 'jose';

const STACK_PROJECT_ID = process.env.STACK_PROJECT_ID!;
const jwks = jose.createRemoteJWKSet(
  new URL(`https://api.stack-auth.com/api/v1/projects/${STACK_PROJECT_ID}/.well-known/jwks.json`)
);

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const accessToken = req.headers['x-stack-access-token'] as string;

  if (!accessToken) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  try {
    const { payload } = await jose.jwtVerify(accessToken, jwks);

    // Attach user info to request
    (req as any).user = {
      id: payload.sub,
      email: payload.email as string | undefined,
      name: payload.name as string | undefined,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

### Client-Side: Sending Token to Backend

```typescript
// In the React frontend, when calling the backend proxy:
const user = useUser();

async function callBackendProxy(endpoint: string, body: any) {
  const { accessToken } = await user.getAuthJson();

  const response = await fetch(`/api/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-stack-access-token': accessToken!,
    },
    body: JSON.stringify(body),
  });

  return response;
}
```

**Important**: `getAuthJson()` returns `{ accessToken: string | null }`. The token is a JWT that expires after ~10 minutes. Stack Auth SDK **automatically refreshes** it on the client side, so `getAuthJson()` always returns a fresh token.

---

## 4. Client-Side Hooks Reference

### useUser()

```typescript
import { useUser } from '@stackframe/stack';

// Basic - returns null if not signed in
const user = useUser();

// With redirect - never returns null
const user = useUser({ or: "redirect" });

// With throw - never returns null, throws if not signed in
const user = useUser({ or: "throw" });
```

### useStackApp()

```typescript
import { useStackApp } from '@stackframe/stack';

const app = useStackApp();  // Returns StackClientApp

// Available methods:
app.signInWithOAuth("google");
app.signInWithCredential({ email, password });
app.signUpWithCredential({ email, password });
app.sendForgotPasswordEmail(email);
app.sendMagicLinkEmail(email);
app.redirectToSignIn();
app.redirectToSignUp();

// Also has hook methods:
const user = app.useUser();
const project = app.useProject();
```

### User Object Methods

```typescript
// Update user profile
await user.update({ displayName: "New Name" });

// Update password
await user.updatePassword({ oldPassword, newPassword });

// Get auth tokens for backend calls
const { accessToken } = await user.getAuthJson();

// Get auth headers for fetch
const headers = await user.getAuthHeaders();
// Returns: { 'x-stack-access-token': '...' }

// Sign out
await user.signOut();

// Delete account
await user.delete();
```

---

## 5. Cookie-Based Token Storage for SPAs

### How `tokenStore: "cookie"` Works

When `tokenStore` is set to `"cookie"`, Stack Auth SDK:
1. Stores the **refresh token** in an HTTP cookie
2. Stores the **access token** (JWT) in an HTTP cookie
3. Automatically refreshes the access token before it expires (~10 min default)
4. On page load, reads cookies to restore the session

**This is the correct approach for Nexus** as a Vite SPA.

### Alternative: `tokenStore: "nextjs-cookie"`
Only for Next.js apps using server components. Not applicable to Nexus.

### Security Considerations from Docs

- **Never store JWTs in localStorage** for sensitive applications
- Stack Auth handles secure token storage automatically via cookies
- Access tokens expire in ~10 minutes (configurable via `STACK_ACCESS_TOKEN_EXPIRATION_TIME`)
- The SDK auto-refreshes tokens before expiry
- Always use HTTPS in production

---

## 6. Environment Variables

### Client-Side (Vite - already set up)

```env
VITE_STACK_PROJECT_ID=<your-project-id>
VITE_STACK_PUBLISHABLE_CLIENT_KEY=pck_<your-key>
```

These are safe to expose in client code (prefixed with `pck_`).

### Server-Side (New - for backend)

```env
STACK_PROJECT_ID=<your-project-id>
STACK_SECRET_SERVER_KEY=ssk_<your-key>
```

**CRITICAL**: The secret server key (`ssk_...`) must NEVER be exposed to the client. It provides full read/write access to all users.

### Required Headers for Server API Calls

| Header | Value | Description |
|--------|-------|-------------|
| `X-Stack-Access-Type` | `"server"` | Required for server access |
| `X-Stack-Project-Id` | Your project UUID | Required |
| `X-Stack-Secret-Server-Key` | `ssk_<key>` | Required for server access |
| `X-Stack-Access-Token` | JWT from client | Optional - to act on behalf of user |

---

## 7. Custom User Data (Metadata)

Stack Auth supports three metadata fields on users:

### clientMetadata
- Readable and writable from client AND server
- Use for non-sensitive user preferences

### serverMetadata
- Readable and writable ONLY from server
- Use for sensitive data (e.g., API usage counts, internal flags)

### clientReadOnlyMetadata
- Readable from client, writable only from server
- Use for things like subscription status, feature flags

```typescript
// Server-side: set metadata via REST API
await fetch(`https://api.stack-auth.com/api/v1/users/${userId}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'x-stack-access-type': 'server',
    'x-stack-project-id': STACK_PROJECT_ID,
    'x-stack-secret-server-key': STACK_SECRET_SERVER_KEY,
  },
  body: JSON.stringify({
    server_metadata: { apiCallCount: 42 },
    client_read_only_metadata: { plan: "free" },
  }),
});
```

---

## 8. Server-Side User Management via REST API

### List All Users
```
GET https://api.stack-auth.com/api/v1/users
Headers: x-stack-access-type: server, x-stack-project-id, x-stack-secret-server-key
```

### Get User by ID
```
GET https://api.stack-auth.com/api/v1/users/{user_id}
Headers: x-stack-access-type: server, x-stack-project-id, x-stack-secret-server-key
```

### Create User (server-side)
```
POST https://api.stack-auth.com/api/v1/users
Headers: x-stack-access-type: server, x-stack-project-id, x-stack-secret-server-key
Body: { "primary_email": "...", "display_name": "...", "password": "..." }
```

### Update User
```
PATCH https://api.stack-auth.com/api/v1/users/{user_id}
Headers: x-stack-access-type: server, x-stack-project-id, x-stack-secret-server-key
Body: { "display_name": "...", "server_metadata": {...} }
```

---

## 9. SDK Package Details

- **Package**: `@stackframe/stack` v2.8.77
- **Exports used by Nexus**:
  - `StackClientApp` (constructor)
  - `StackProvider` (React context provider)
  - `StackTheme` (theme wrapper)
  - `SignIn` (sign-in UI component)
  - `useUser` (React hook)
  - `useStackApp` (React hook)
- **Not used but available**: `SignUp`, `UserButton`, `AccountSettings`, `ForgotPassword`, `PasswordReset`

### Dependencies Required for Backend

For the Node.js backend, we need:
```json
{
  "jose": "^5.x",         // JWT verification with JWKS
  "express": "^4.x",       // HTTP server
  "cors": "^2.x",          // Cross-origin support
  "dotenv": "^16.x"        // Environment variables
}
```

**Do NOT install `@stackframe/stack` on the backend** - it's a React SDK. Use the REST API + `jose` for JWT verification instead.

---

## 10. Production Considerations

From Stack Auth docs:
1. **Domains**: Configure allowed callback URLs in dashboard (disable localhost in prod)
2. **OAuth keys**: Replace shared dev keys with your own (Google, GitHub, etc.)
3. **Email server**: Configure custom SMTP for branded emails
4. **HTTPS**: Always required for JWT transmission
5. **Token expiration**: Default 10 minutes, auto-refreshed by SDK

---

## 11. Migration Considerations (username -> user.id)

The current Nexus codebase uses `user.id` from Stack Auth as the `username` parameter for local DB operations. This is already correct - Stack Auth user IDs are UUIDs like `3241a285-8329-4d69-8f3d-316e08cf140c`.

The local DB schema uses `username STRING` columns. When migrating:
- Existing records with old usernames (pre-Stack Auth) should be migrated to Stack Auth user IDs
- The `ensureUserExists()` function in `dbService.ts` already uses `user.id` from the `useUser()` hook
- No schema changes needed - just data migration for any legacy records with `username = 'anon'`

---

## 12. Architecture Decision: JWT vs REST API for Auth Middleware

| Factor | JWT Verification | REST API |
|--------|-----------------|----------|
| Latency | ~1ms (local) | ~100-300ms (network) |
| User data | Basic (from JWT claims) | Full (all metadata) |
| Offline resilience | Works with cached JWKS | Requires network |
| Implementation | `jose` library | `fetch` call |
| Token revocation | Not immediate (waits for expiry) | Immediate |
| Dependencies | `jose` (lightweight) | None extra |

**Verdict**: Use JWT verification. For our LLM proxy, we only need user identity (sub claim), not full profile data. The ~10min token expiry provides sufficient security for token revocation.
