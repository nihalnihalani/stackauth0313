# Stack Auth - Complete Documentation Reference

> Open-source authentication that gets you started in minutes.
> Source: https://docs.stack-auth.com/docs/overview

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
   - [Setup & Installation](#setup--installation)
   - [Users](#users)
   - [Components](#components)
   - [Production Checklist](#production-checklist)
3. [Core Concepts](#core-concepts)
   - [Stack App](#stack-app)
   - [Auth Providers](#auth-providers)
   - [Backend Integration](#backend-integration)
   - [JWT Tokens](#jwt-tokens)
   - [Custom User Data](#custom-user-data)
   - [Sign-up Rules](#sign-up-rules)
   - [User Onboarding](#user-onboarding)
   - [Team Selection](#team-selection)
4. [Apps & Features](#apps--features)
   - [Orgs and Teams](#orgs-and-teams)
   - [RBAC Permissions](#rbac-permissions)
   - [Emails](#emails)
   - [Webhooks](#webhooks)
   - [API Keys](#api-keys)
   - [Payments (Stripe)](#payments-stripe)
   - [OAuth (Connected Accounts)](#oauth-connected-accounts)
   - [Analytics](#analytics)
5. [Customization](#customization)
   - [Custom Pages](#custom-pages)
   - [Custom Styles](#custom-styles)
   - [Dark Mode](#dark-mode)
   - [Internationalization (i18n)](#internationalization-i18n)
6. [Integrations](#integrations)
   - [Supabase](#supabase)
   - [Convex](#convex)
   - [CLI Authentication](#cli-authentication)
   - [Self-Hosting](#self-hosting)
7. [REST API Reference](#rest-api-reference)
8. [SDK Reference](#sdk-reference)
9. [FAQ](#faq)

---

## Overview

Stack Auth is an open-source authentication and user management platform. It provides:

- **Pre-built UI components**: `<SignIn />`, `<SignUp />`, `<UserButton />`, `<AccountSettings />`, `<SelectedTeamSwitcher />`, `<StackHandler />`
- **SDKs**: Next.js, React, vanilla JavaScript, and a REST API for Python/any language
- **Features**: Authentication, authorization (RBAC), teams/orgs, payments (Stripe), webhooks, analytics, email system, API keys
- **Open-source and self-hostable**

### Supported Platforms

- **Next.js** (App Router only — Pages Router is not officially supported)
- **React** (Vite and other React setups)
- **JavaScript/TypeScript** (Node.js with Express)
- **Python** (Django, FastAPI, Flask via REST API)
- Any language via the REST API

---

## Getting Started

### Setup & Installation

#### Prerequisites

- **Next.js**: App router project
- **React**: Vite or similar React project
- **JavaScript**: Node.js project with Express
- **Python**: Python environment with Django, FastAPI, or Flask

#### Setup Wizard (Recommended for JS)

```bash
npx @stackframe/stack-cli@latest init
```

Then create an account on the [Stack Auth dashboard](https://app.stack-auth.com/projects), create a project with an API key, and copy the environment variables.

**Files created for Next.js:**
- `app/handler/[...stack]/page.tsx` — Default auth pages (sign-in, sign-out, account settings)
- `app/layout.tsx` — Updated to wrap body with `StackProvider` and `StackTheme`
- `app/loading.tsx` — Suspense boundary for async hooks
- `stack/server.ts` — Contains `stackServerApp` for server-side usage
- `stack/client.ts` — Contains `stackClientApp` for client-side usage

#### Manual Installation

1. Install the package:
   ```bash
   npm install @stackframe/stack
   ```

2. Create API keys on the [Stack Auth dashboard](https://app.stack-auth.com/handler/sign-up)

3. Set environment variables:
   ```env
   NEXT_PUBLIC_STACK_PROJECT_ID=<your-project-id>
   NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=<your-publishable-client-key>
   STACK_SECRET_SERVER_KEY=<your-secret-server-key>
   ```

4. Create Stack app configuration
5. Set up authentication handlers
6. Wrap app with `StackProvider` and `StackTheme`

---

### Users

#### Client Component — `useUser()` hook

```tsx
"use client";
import { useUser } from "@stackframe/stack";

export function MyComponent() {
  const user = useUser();
  return <div>{user ? `Hello, ${user.displayName}` : 'Not logged in'}</div>;
}
```

To redirect unauthenticated users:
```tsx
const user = useUser({ or: "redirect" });
```

#### Server Component — `getUser()`

```tsx
import { stackServerApp } from "@/stack/server";

export default async function MyServerComponent() {
  const user = await stackServerApp.getUser();
  // or: await stackServerApp.getUser({ or: "redirect" })
}
```

#### Protecting Pages

Three methods:

1. **Client Component**: `useUser({ or: 'redirect' })`
2. **Server Component**: `await stackServerApp.getUser({ or: 'redirect' })`
3. **Middleware**: Check user in `middleware.tsx` and redirect

**Client Component example:**
```tsx
"use client";
import { useUser } from "@stackframe/stack";

export default function MyProtectedPage() {
  useUser({ or: 'redirect' });
  return <h1>You can only see this if you are logged in</h1>;
}
```

**Server Component example:**
```tsx
import { stackServerApp } from "@/stack/server";

export default async function MyProtectedPage() {
  await stackServerApp.getUser({ or: 'redirect' });
  return <h1>You can only see this if you are logged in</h1>;
}
```

**Middleware example:**
```tsx
export async function middleware(request: NextRequest) {
  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/handler/sign-in', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/protected/:path*',
};
```

#### Updating User Data

```tsx
await user.update({ displayName: "New Name" });
```

#### Signing Out

```tsx
await user.signOut();
// or redirect to /handler/sign-out
```

#### Example: Custom Profile Page

```tsx
'use client';
import { useUser, useStackApp, UserButton } from "@stackframe/stack";

export default function ProfilePage() {
  const user = useUser();
  const app = useStackApp();
  return (
    <div>
      {user ? (
        <div>
          <UserButton />
          <p>Welcome, {user.displayName ?? "unnamed user"}</p>
          <p>Your e-mail: {user.primaryEmail}</p>
          <button onClick={() => user.signOut()}>Sign Out</button>
        </div>
      ) : (
        <div>
          <p>You are not logged in</p>
          <button onClick={() => app.redirectToSignIn()}>Sign in</button>
          <button onClick={() => app.redirectToSignUp()}>Sign up</button>
        </div>
      )}
    </div>
  );
}
```

---

### Components

Stack Auth provides pre-built React components:

| Component | Description |
|-----------|-------------|
| `<SignIn />` | Sign-in form (OAuth + email/password + magic link) |
| `<SignUp />` | Sign-up form |
| `<UserButton />` | Avatar with dropdown for user settings |
| `<AccountSettings />` | Full account settings page |
| `<SelectedTeamSwitcher />` | Team selection dropdown |
| `<StackHandler />` | Creates all default auth pages |
| `<StackProvider />` | Context provider for Stack Auth |
| `<StackTheme />` | Theme provider for Stack components |
| `<OAuthButtonGroup />` | Group of OAuth sign-in buttons |
| `<OAuthButton />` | Individual OAuth sign-in button |
| `<MagicLinkSignIn />` | Magic link sign-in form |
| `<CredentialSignIn />` | Email/password sign-in form |
| `<CredentialSignUp />` | Email/password sign-up form |
| `<ForgotPassword />` | Forgot password form |
| `<PasswordReset />` | Password reset form |

Components are modular — `<SignIn />` is composed of `<OAuthButtonGroup />`, `<MagicLinkSignIn />`, and `<CredentialSignIn />`, which can be used individually for custom sign-in pages.

---

### Production Checklist

Before going to production:

#### 1. Domains
Add your domain in the Stack dashboard under `Domain & Handlers`. Disable `Allow all localhost callbacks for development`.

#### 2. OAuth Providers
Replace shared OAuth keys with your own. Set up OAuth apps on each provider's website with the callback URL:
```
https://api.stack-auth.com/api/v1/auth/oauth/callback/<provider>
```

Supported providers and their callback URLs:
- Google: `https://api.stack-auth.com/api/v1/auth/oauth/callback/google`
- GitHub: `https://api.stack-auth.com/api/v1/auth/oauth/callback/github`
- Facebook: `https://api.stack-auth.com/api/v1/auth/oauth/callback/facebook`
- Microsoft: `https://api.stack-auth.com/api/v1/auth/oauth/callback/microsoft`
- Spotify: `https://api.stack-auth.com/api/v1/auth/oauth/callback/spotify`
- GitLab: `https://api.stack-auth.com/api/v1/auth/oauth/callback/gitlab`
- Bitbucket: `https://api.stack-auth.com/api/v1/auth/oauth/callback/bitbucket`
- LinkedIn: `https://api.stack-auth.com/api/v1/auth/oauth/callback/linkedin`
- X (Twitter): `https://api.stack-auth.com/api/v1/auth/oauth/callback/x`

Enter client ID and secret in the Stack dashboard under `Auth Methods`.

#### 3. Email Server
Configure your own SMTP server in the Stack dashboard under `Emails > Email Server`. Switch from `Shared` to `Custom SMTP server` and enter your SMTP host, port, username, password, sender email, and sender name.

#### 4. Enable Production Mode
Toggle production mode on the `Project Settings` tab.

---

## Core Concepts

### Stack App

The `StackApp` is the central object connecting your code to Stack's servers.

- **`StackClientApp`** — Frontend use. Requires publishable client key. Provides current user data.
- **`StackServerApp`** — Backend use. Has all client functionality plus elevated permissions (list/modify ALL users). Requires secret server key (must be kept secret!).
- **`StackAdminApp`** — Rarely used. For automation/internal tools. Can edit project configuration.

#### `getXyz` vs. `useXyz`

- `getXyz()`/`listXyz()` — Async functions returning `Promise`. Use in Server Components or event handlers.
- `useXyz()` — React hooks that suspend until data is available. Use in Client Components.

```tsx
// Server Component
async function ServerComponent() {
  const app = stackServerApp;
  const user = await app.getUser(); // returns a Promise
  return <div>{user.displayName}</div>;
}

// Client Component
"use client";
function ClientComponent() {
  const app = useStackApp();
  const user = app.useUser(); // returns value directly
  return <div>{user.displayName}</div>;
}
```

---

### Auth Providers

#### OAuth Providers
- GitHub, Google, Facebook, Microsoft, Spotify, Discord, GitLab, Apple, Bitbucket, LinkedIn, X (Twitter), Twitch

#### Other Methods
- **Passkey** — WebAuthn-based passwordless authentication
- **Two-Factor Authentication (2FA)** — TOTP-based MFA
- **Email/Password** — Credential-based sign-in
- **Magic Link** — Passwordless email sign-in
- **Anonymous sign-up** — Create accounts with no email

Each provider can be configured in the Stack Auth dashboard under `Auth Methods`.

---

### Backend Integration

To authenticate endpoints on your own server, send the user's access token in request headers.

#### Getting the Access Token (Client)

```typescript
const { accessToken } = await user.getAuthJson();
const response = await fetch('/api/users/me', {
  headers: { 'x-stack-access-token': accessToken },
});
```

#### Verifying the Token (Server)

**Option 1: JWT Verification** (fast, no external request)

Node.js:
```javascript
import * as jose from 'jose';

const jwks = jose.createRemoteJWKSet(
  new URL("https://api.stack-auth.com/api/v1/projects/<your-project-id>/.well-known/jwks.json")
);

try {
  const { payload } = await jose.jwtVerify(accessToken, jwks);
  console.log('Authenticated user with ID:', payload.sub);
} catch (error) {
  console.log('Invalid user');
}
```

Python:
```python
import jwt
from jwt import PyJWKClient

jwks_client = PyJWKClient("https://api.stack-auth.com/api/v1/projects/<your-project-id>/.well-known/jwks.json")

try:
    signing_key = jwks_client.get_signing_key_from_jwt(access_token)
    payload = jwt.decode(access_token, signing_key.key, algorithms=["ES256"], audience="<your-project-id>")
    print('Authenticated user with ID:', payload['sub'])
except Exception as error:
    print('Invalid user')
```

**Option 2: REST API Verification** (full user profile)

Node.js:
```javascript
const response = await fetch('https://api.stack-auth.com/api/v1/users/me', {
  headers: {
    'x-stack-access-type': 'server',
    'x-stack-project-id': '<project-id>',
    'x-stack-secret-server-key': '<secret-key>',
    'x-stack-access-token': accessToken,
  },
});

if (response.status === 200) {
  console.log('User is authenticated', await response.json());
}
```

Python:
```python
import requests

response = requests.get('https://api.stack-auth.com/api/v1/users/me', headers={
    'x-stack-access-type': 'server',
    'x-stack-project-id': '<project-id>',
    'x-stack-secret-server-key': '<secret-key>',
    'x-stack-access-token': access_token,
})

if response.status_code == 200:
    print('User is authenticated', response.json())
```

---

### JWT Tokens

Stack Auth uses ES256-signed JWTs with a default 10-minute lifetime (auto-refreshed by the SDK).

#### JWT Structure

**Header**: `alg` (ES256), `kid` (key identifier)

**Standard Claims**:
| Claim | Description |
|-------|-------------|
| `iss` | Issuer URL |
| `sub` | User ID |
| `aud` | Project ID |
| `exp` | Expiration timestamp |
| `iat` | Issued-at timestamp |

**Stack Auth Claims**:
| Claim | Description |
|-------|-------------|
| `project_id` | Project ID |
| `branch_id` | Always `main` |
| `role` | `authenticated` |
| `name` | User display name (nullable) |
| `email` | User email (nullable) |
| `email_verified` | Boolean |
| `selected_team_id` | Currently selected team (nullable) |
| `is_anonymous` | Boolean |
| `is_restricted` | Boolean |
| `restricted_reason` | Why user is restricted (nullable) |

#### Example JWT Payload
```json
{
  "iss": "https://api.stack-auth.com/api/v1/projects/project_abcdef",
  "sub": "user_123456",
  "aud": "project_abcdef",
  "exp": 1735689600,
  "iat": 1735603200,
  "project_id": "project_abcdef",
  "branch_id": "main",
  "role": "authenticated",
  "name": "John Doe",
  "email": "john@example.com",
  "email_verified": true,
  "selected_team_id": "team_789",
  "is_anonymous": false,
  "is_restricted": false,
  "restricted_reason": null
}
```

#### Anonymous User Tokens
- `iss` becomes `.../projects-anonymous-users/<project-id>`
- `aud` becomes `<project-id>:anon`
- `is_anonymous` is `true`, `is_restricted` is `true`

#### Restricted User Tokens
- `iss` becomes `.../projects-restricted-users/<project-id>`
- `aud` becomes `<project-id>:restricted`
- `restricted_reason` is `{ "type": "email_not_verified" }` or `{ "type": "restricted_by_administrator" }`

#### Security Best Practices
- Never store JWTs in localStorage for sensitive apps
- Use secure, httpOnly cookies when possible
- Always verify JWT signatures on the server
- Let the SDK handle token storage and refresh automatically

#### Signing Keys
- Private keys are deterministically derived from project ID and `STACK_SERVER_SECRET`
- No key material is stored in the database
- JWKS exposes current and legacy compatibility keys
- Tokens are always signed server-side; client SDKs never receive private keys

---

### Custom User Data

Three metadata fields for storing additional user info:

| Field | Client Read | Client Write | Server Read | Server Write |
|-------|:-----------:|:------------:|:-----------:|:------------:|
| `clientMetadata` | Yes | Yes | Yes | Yes |
| `serverMetadata` | No | No | Yes | Yes |
| `clientReadOnlyMetadata` | Yes | No | Yes | Yes |

#### Client Metadata
```tsx
await user.update({
  clientMetadata: { mailingAddress: "123 Main St" },
});

// Read on client:
const user = useUser();
console.log(user.clientMetadata);
```

#### Server Metadata
```tsx
const user = await stackServerApp.getUser();
await user.update({
  serverMetadata: { secretInfo: "This is a secret" },
});
```

#### Client Read-Only Metadata
```tsx
// Server writes:
await user.update({
  clientReadOnlyMetadata: { subscriptionPlan: "premium" },
});

// Client reads:
const user = useUser();
console.log(user.clientReadOnlyMetadata);
```

---

### Sign-up Rules

Control who can sign up with customizable rules evaluated during sign-up for all auth methods.

#### Available Conditions
| Variable | Type | Description |
|----------|------|-------------|
| `email` | string | User's email (normalized to lowercase) |
| `emailDomain` | string | Domain part of email (after @) |
| `authMethod` | string | `password`, `otp`, `oauth`, or `passkey` |
| `oauthProvider` | string | OAuth provider ID (e.g., `google`, `github`) |

#### String Operations
- `contains("substring")`, `startsWith("prefix")`, `endsWith("suffix")`
- `matches("regex")`, `==`, `!=`
- Combine with AND/OR logic

#### Actions
| Action | Description |
|--------|-------------|
| **Allow** | Normal sign-up |
| **Reject** | Block sign-up with message |
| **Restrict** | Sign up but mark account as restricted |
| **Log** | Log for analytics, no action taken |

#### Priority
Rules evaluate highest priority first. First matching rule's action applies. Default action applies when no rules match (default is Allow).

#### Common Use Cases
- **Block disposable emails**: `emailDomain.matches("(tempmail|throwaway)\\..*")` → Reject
- **Allow only corporate domains**: Set default to Reject, create Allow rule for `emailDomain == "company.com"`
- **Restrict non-verified auth**: `authMethod == "oauth" && oauthProvider != "google"` → Restrict

#### Testing Rules
Use the built-in rule tester at the bottom of the Sign-up Rules page to simulate sign-up attempts without affecting real users.

---

### User Onboarding

Store an `onboarded` flag in user metadata and redirect users if not completed:

```tsx
// Onboarding page
export default function OnboardingPage() {
  const user = useUser();
  const router = useRouter();
  const [address, setAddress] = useState('');

  return (
    <>
      <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} />
      <button onClick={async () => {
        await user.update({
          clientMetadata: { onboarded: true, address },
        });
        router.push('/');
      }}>Submit</button>
    </>
  );
}
```

#### Client-side onboarding check hook:
```tsx
export function useOnboarding() {
  const user = useUser();
  const router = useRouter();
  useEffect(() => {
    if (!user.clientReadOnlyMetadata.onboarded) {
      router.push('/onboarding');
    }
  }, [user]);
}
```

#### Server-side onboarding check:
```tsx
export async function ensureOnboarded() {
  const user = await stackServerApp.getUser();
  if (!user.clientReadOnlyMetadata.onboarded) {
    redirect('/onboarding');
  }
}
```

For tamper-proof onboarding, validate and store the `onboarded` flag in `clientReadOnlyMetadata` from the server.

---

### Team Selection

Two methods for selecting a "current team":

1. **Deep Link** (recommended): Each team has a unique URL (`/team/<team-id>`). Shared links always point to the correct team.
2. **Current Team**: Global "selected team" state. Simpler but can cause confusion with shared links or multiple tabs.

#### `<SelectedTeamSwitcher />` Component

```tsx
// Current team method
<SelectedTeamSwitcher />

// Deep link + most recent team
<SelectedTeamSwitcher urlMap={team => `/team/${team.id}`} selectedTeam={team} />

// Deep link + default team (no auto-update)
<SelectedTeamSwitcher urlMap={team => `/team/${team.id}`} selectedTeam={team} noUpdateSelectedTeam />
```

---

## Apps & Features

### Orgs and Teams

Teams group users and manage permissions. Users can belong to multiple teams simultaneously.

#### Creating Teams
```tsx
// Client-side (requires "client side team creation" enabled in dashboard)
const team = await user.createTeam({ displayName: 'New Team' });

// Server-side (no user added)
const team = await stackServerApp.createTeam({ displayName: 'New Team' });
```

#### Retrieving Teams
```tsx
// Client
const allTeams = user.useTeams();
const someTeam = user.useTeam('team-id');

// Server
const allTeams = await user.listTeams();
const someTeam = await user.getTeam('team-id');
```

#### Team Operations

| Operation | Client Permission Required | Code |
|-----------|---------------------------|------|
| Update team | `$update_team` | `await team.update({ displayName: 'New Name' })` |
| List users | `$read_members` | `team.useUsers()` / `await team.listUsers()` |
| Invite user (email) | `$invite_members` | `await team.inviteUser(email)` |
| Add user (no email) | Server only | `await team.addUser(userId)` |
| Remove user | `$remove_members` | `await team.removeUser(userId)` |
| Leave team | None | `await user.leaveTeam(team)` |
| Delete team | `$delete_team` | `await team.delete()` |

#### Team Metadata
Same three fields as users: `clientMetadata`, `serverMetadata`, `clientReadOnlyMetadata`.

```tsx
await team.update({ clientMetadata: { customField: 'value' } });
```

#### Team Profiles
Users can have per-team profiles (`displayName`, `profileImageUrl`). Empty profiles fall back to the user's personal profile. Visible to members with `$read_members` permission.

```tsx
// Client
const teamProfile = user.useTeamProfile(team);

// Server
const teamProfile = await user.getTeamProfile(team);
```

---

### RBAC Permissions

Two permission types:

1. **Team Permissions** — Actions within a specific team
2. **Project Permissions** — Global permissions across the entire project

#### System Permissions (built-in, prefixed with `$`)
- `$invite_members` — Invite users to team
- `$remove_members` — Remove users from team
- `$read_members` — View team member list
- `$update_team` — Update team info
- `$delete_team` — Delete the team
- `$manage_api_keys` — Manage team API keys

System permissions cannot be modified but can be assigned to members or included in other permissions.

#### Checking Permissions

```tsx
// Client — team permission
const permission = user.usePermission(team, 'read');

// Server — team permission
const permission = await user.getPermission(team, 'read');

// Client — project permission
const permission = user.usePermission('access_admin_dashboard');

// Server — project permission
const permission = await user.getPermission('access_admin_dashboard');
```

#### Listing All Permissions

```tsx
// Client
const permissions = user.usePermissions();

// Server
const permissions = await user.listPermissions();
```

#### Managing Permissions (Server only)

```tsx
// Team permissions
await user.grantPermission(team, 'read');
await user.revokePermission(team, 'read');

// Project permissions
await user.grantPermission('access_admin_dashboard');
await user.revokePermission('access_admin_dashboard');
```

Permissions support hierarchical nesting (e.g., `admin` includes `moderator` includes `user`). Create permissions in the Stack dashboard under `Team Permissions` or `Project Permissions`.

---

### Emails

Stack Auth provides an email system with two types:
- **Transactional Emails** — Required for app usage, cannot be opted out
- **Marketing Emails** — Always include unsubscribe link

#### Sending Emails (Server-side only)

```typescript
// HTML email
const result = await stackServerApp.sendEmail({
  userIds: ['user-id-1', 'user-id-2'],
  subject: 'Welcome to our platform!',
  html: '<h1>Welcome!</h1><p>Thanks for joining us.</p>',
});

// Template-based email
const result = await stackServerApp.sendEmail({
  userIds: ['user-id'],
  templateId: 'welcome-template',
  subject: 'Welcome!',
  variables: { userName: 'John Doe', activationUrl: 'https://...' },
});
```

#### SendEmail Options
```typescript
type SendEmailOptions = {
  userIds: string[];
  subject?: string;
  html?: string;
  templateId?: string;
  variables?: Record<string, any>;
  themeId?: string | null | false;
  notificationCategoryName?: string;
};
```

#### Built-in Templates
| Template | Description |
|----------|-------------|
| `email_verification` | Email address verification |
| `password_reset` | Password reset flow |
| `magic_link` | Passwordless authentication |
| `team_invitation` | Team join invitation |
| `sign_in_invitation` | Sign-up invitation |
| `payment_receipt` | Successful payment receipt |
| `payment_failed` | Failed payment notification |

#### Error Handling
```typescript
if (result.status === 'error') {
  switch (result.error.code) {
    case 'REQUIRES_CUSTOM_EMAIL_SERVER': break;
    case 'SCHEMA_ERROR': break;
    case 'USER_ID_DOES_NOT_EXIST': break;
  }
}
```

#### Email Configuration
- **Shared (Development)**: Sends from `noreply@stackframe.co`, no setup needed
- **Custom SMTP (Production)**: Configure host, port, username, password, sender in dashboard

#### Notification Categories
```typescript
await stackServerApp.sendEmail({
  userIds: ['user-id'],
  html: '<p>New feature!</p>',
  subject: 'Product Updates',
  notificationCategoryName: 'product_updates',
});
```
Users can opt in/out through account settings.

---

### Webhooks

Receive real-time POST requests when events occur in your Stack project.

#### Setup
Create a webhook endpoint in the Stack dashboard under "Webhooks" with your server URL.

#### Event Types
| Event | Description |
|-------|-------------|
| `user.created` | User is created |
| `user.updated` | User is updated |
| `user.deleted` | User is deleted |
| `team.created` | Team is created |
| `team.updated` | Team is updated |
| `team.deleted` | Team is deleted |
| `team_membership.created` | User added to team |
| `team_membership.deleted` | User removed from team |
| `team_permission.created` | Team permission created |
| `team_permission.deleted` | Team permission deleted |

#### Payload Example
```json
{
  "type": "team.created",
  "data": {
    "id": "2209422a-eef7-4668-967d-be79409972c5",
    "display_name": "My Team"
  }
}
```

#### Verifying Webhooks
Use the Svix library to verify signatures and prevent replay attacks:

```javascript
import { Webhook } from "svix";

const secret = "<from the dashboard>";
const headers = {
  "svix-id": "<from the webhook request headers>",
  "svix-timestamp": "<from the webhook request headers>",
  "svix-signature": "<from the webhook request headers>",
};
const payload = "<the webhook request body>";

const wh = new Webhook(secret);
const verifiedPayload = wh.verify(payload, headers); // Throws on error
```

#### Testing Locally
Use [Svix Playground](https://www.svix.com/play/) or [Webhook.site](https://webhook.site/) to test webhook receiving.

---

### API Keys

Enable users and teams to generate API keys for programmatic access to your backend services.

#### Types
- **User API Keys** — Associated with individual users
- **Team API Keys** — Associated with teams (requires `$manage_api_keys` permission)

#### Enable
Go to **Apps > API Keys** in the Stack dashboard and click Enable.

#### Pre-built UI
The `<AccountSettings />` component automatically includes an API Keys tab for managing user API keys. Team API keys are managed from team settings.

#### Validating API Keys (Server)
```typescript
// User API key
const user = await stackServerApp.getUser({ apiKey: requestApiKey });

// Team API key
const team = await stackServerApp.getTeam({ apiKey: requestApiKey });
```

#### Best Practices
- Always use HTTPS in production
- Validate on every request server-side
- Use common headers: `X-Stack-Api-Key`, `Authorization: Bearer <key>`, or `X-Api-Key`
- Implement rate limiting and monitor usage

---

### Payments (Stripe)

Stack Auth integrates with Stripe for billing, subscriptions, and one-time purchases.

#### Core Concepts
| Concept | Description |
|---------|-------------|
| **Product** | A sellable offer (one-time or subscription) |
| **Product Line** | Mutually exclusive set of products (one active per customer) |
| **Item** | Quantifiable entitlement (credits, seats, API calls) |
| **Customer** | Owner of purchases (user, team, or custom) |
| **Transaction** | A billing event recorded in the dashboard |

#### Quick Setup
1. Enable Payments in dashboard (**Apps > Payments**)
2. Connect Stripe in **Payments > Settings**
3. Create product lines in **Payments > Product Lines**
4. Create products and attach items in **Payments > Products & Items**
5. Generate checkout URLs in your app
6. Enable test mode for testing

#### Creating Checkout URLs
```typescript
// User purchase
const url = await user.createCheckoutUrl({
  productId: 'product-id',
  returnUrl: 'https://yourapp.com/dashboard',
});

// Team purchase
const url = await team.createCheckoutUrl({
  productId: 'product-id',
  returnUrl: 'https://yourapp.com/team-dashboard',
});
```

#### Managing Items
```typescript
// Get item quantity
const item = await user.getItem('credits');
console.log(item.quantity);

// React hook for real-time updates
const item = user.useItem('credits');

// Server: consume credits (race-condition-safe)
const result = await serverItem.tryDecreaseQuantity(1);
```

#### Listing Products
```typescript
const products = await user.listProducts();
```

#### Granting Products (Server-side)
```typescript
await serverUser.grantProduct('product-id');
```

#### Customer Types
- **Users** — Individual user accounts
- **Teams** — Team/organization accounts
- **Custom Customers** — External entities by custom ID

#### Payment Emails
Automatic email notifications for:
- **Payment Receipt** — On successful payment
- **Payment Failed** — On failed payment

#### Test Mode
Enable in **Payments > Settings**. All purchases are free. Test card: `4242 4242 4242 4242`.

Currently available for US-based businesses only. No additional Stack Auth fees.

---

### OAuth (Connected Accounts)

Beyond sign-in, Stack manages OAuth access tokens for API access on behalf of users.

**Requires custom OAuth keys** (not shared keys). See [Production Checklist](#production-checklist).

#### Connecting with a Provider
```tsx
'use client';
import { useUser } from "@stackframe/stack";

export default function Page() {
  const user = useUser({ or: 'redirect' });
  const account = user.useConnectedAccount('google', { or: 'redirect' });
  return <div>Google account connected</div>;
}
```

#### With Scopes
```tsx
const account = user.useConnectedAccount('google', {
  or: 'redirect',
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});
```

#### Getting Access Token
```tsx
const { accessToken } = account.useAccessToken();

// Use to call provider APIs
const response = await fetch('https://www.googleapis.com/drive/v3/files', {
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

#### Sign-in Default Scopes
Request scopes during sign-in to avoid showing the authorization page twice:
```tsx
export const stackServerApp = new StackServerApp({
  oauthScopesOnSignIn: {
    google: ['https://www.googleapis.com/auth/drive.readonly'],
  },
});
```

#### Account Merging Strategies
| Strategy | Description |
|----------|-------------|
| **Link** (default) | Links OAuth identity to existing account with same verified email |
| **Allow** (legacy) | Creates a separate account |
| **Block** | Raises error if matching account exists |

---

### Analytics

Three areas in the dashboard:

#### Tables
Browse event rows with sorting, search, and incremental loading. View raw event data without writing SQL.

#### Queries
ClickHouse SQL workspace for deeper analysis. Save and re-run reusable queries.

#### Session Replays
Watch session replays filtered by user, team, duration, activity window, and click count.

#### What Gets Tracked
- **Client-side**: `$page-view`, `$click`
- **Server-side**: `$token-refresh`, `$sign-up-rule-trigger`

#### Enabling Session Replays
```typescript
const stackClientApp = new StackClientApp({
  projectId: process.env.NEXT_PUBLIC_STACK_PROJECT_ID!,
  publishableClientKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY!,
  tokenStore: "nextjs-cookie",
  analytics: {
    replays: {
      enabled: true,
      maskAllInputs: true, // default: true
    },
  },
});
```

---

## Customization

### Custom Pages

Replace default auth pages with custom implementations:

#### Simple: Custom layout with Stack components
```tsx title="app/signin/page.tsx"
import { SignIn } from "@stackframe/stack";

export default function CustomSignInPage() {
  return (
    <div>
      <h1>My Custom Sign In</h1>
      <SignIn />
    </div>
  );
}
```

#### From Scratch: Full control with low-level functions
```tsx title="app/signin/page.tsx"
'use client';
import { useStackApp } from "@stackframe/stack";

export default function CustomOAuthSignIn() {
  const app = useStackApp();
  return (
    <div>
      <h1>Custom Sign In</h1>
      <button onClick={() => app.signInWithOAuth('google')}>
        Sign In with Google
      </button>
    </div>
  );
}
```

Update the Stack app to use your custom page:
```tsx title="stack/server.ts"
export const stackServerApp = new StackServerApp({
  urls: { signIn: '/signin' },
});
```

---

### Custom Styles

Override color variables in `StackTheme`:

```tsx
const theme = {
  light: { primary: 'red' },
  dark: { primary: '#00FF00' },
  radius: '8px',
};

<StackTheme theme={theme}>
  {children}
</StackTheme>
```

#### Available Theme Variables
| Variable | Description |
|----------|-------------|
| `background` | Main background color |
| `foreground` | Main text color |
| `card` / `cardForeground` | Card element colors |
| `popover` / `popoverForeground` | Dropdown/popover colors |
| `primary` / `primaryForeground` | Primary brand color & text |
| `secondary` / `secondaryForeground` | Secondary element colors |
| `muted` / `mutedForeground` | Muted/disabled element colors |
| `accent` / `accentForeground` | Accent/highlight colors |
| `destructive` / `destructiveForeground` | Delete/danger action colors |
| `border` | Border color |
| `input` | Input field border color |
| `ring` | Focus ring color |
| `radius` | Border radius for components |

Accepts any valid CSS color syntax: `hsl()`, `hex`, `rgb()`, named colors.

---

### Dark Mode

Stack components support light and dark mode out of the box. Use `next-themes` for switching:

```bash
npm install next-themes
```

```tsx title="components/providers.tsx"
'use client';
import { ThemeProvider } from 'next-themes';
import { StackTheme } from '@stackframe/stack';

export default function Providers({ children }) {
  return (
    <ThemeProvider defaultTheme="system" attribute="class">
      <StackTheme>{children}</StackTheme>
    </ThemeProvider>
  );
}
```

Theme switcher:
```tsx
'use client';
import { useTheme } from 'next-themes';

export default function ColorModeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      {theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    </button>
  );
}
```

---

### Internationalization (i18n)

Pass `lang` prop to `StackProvider`:

```tsx
<StackProvider lang={'de-DE'}>
  {children}
</StackProvider>
```

#### Supported Languages
| Code | Language |
|------|----------|
| `en-US` | English (United States) |
| `de-DE` | German (Germany) |
| `es-419` | Spanish (Latin America) |
| `es-ES` | Spanish (Spain) |
| `fr-CA` | French (Canada) |
| `fr-FR` | French (France) |
| `it-IT` | Italian (Italy) |
| `pt-BR` | Portuguese (Brazil) |
| `pt-PT` | Portuguese (Portugal) |
| `zh-CN` | Chinese (China) |
| `zh-TW` | Chinese (Taiwan) |
| `ja-JP` | Japanese (Japan) |
| `ko-KR` | Korean (South Korea) |

Default is `en-US` if no language is provided.

---

## Integrations

### Supabase

Integrate Stack Auth with Supabase Row Level Security (RLS):

1. Set up Supabase tables with RLS policies
2. Create a server action that mints a Supabase JWT with the Stack Auth user ID:

```tsx title="utils/actions.ts"
'use server';
import { stackServerApp } from "@/stack/server";
import * as jose from "jose";

export const getSupabaseJwt = async () => {
  const user = await stackServerApp.getUser();
  if (!user) return null;

  return await new jose.SignJWT({ sub: user.id, role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET));
};
```

3. Create a Supabase client with the JWT:
```tsx title="utils/supabase-client.ts"
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseJwt } from "./actions";

export const createSupabaseClient = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { accessToken: async () => await getSupabaseJwt() || "" }
  );
};
```

Use webhooks to sync user data between Supabase and Stack Auth.

---

### Convex

1. Create a Convex + Next.js app: `npm create convex@latest`
2. Install Stack Auth: `npx @stackframe/stack-cli@latest init`
3. Update `convex/auth.config.ts`:

```ts
import { getConvexProvidersConfig } from "@stackframe/stack";

export default {
  providers: getConvexProvidersConfig({
    projectId: process.env.NEXT_PUBLIC_STACK_PROJECT_ID,
  }),
};
```

4. Set auth on Convex client:
```ts
convexReactClient.setAuth(stackClientApp.getConvexClientAuth({}));
```

5. Use in queries:
```ts
export const myQuery = query({
  handler: async (ctx) => {
    const obj = await stackServerApp.getPartialUser({ from: "convex", ctx });
    return JSON.stringify(obj);
  },
});
```

---

### CLI Authentication

For terminal-based apps using Python:

1. Download the [Python template](https://github.com/stack-auth/stack-auth/tree/main/docs/public/stack-auth-cli-template.py)
2. Import and call `prompt_cli_login()`:

```python
from stack_auth_cli_template import prompt_cli_login

refresh_token = prompt_cli_login(
    app_url="https://your-app-url.example.com",
    project_id="your-project-id",
    publishable_client_key="your-publishable-client-key",
)

# Exchange refresh token for access token
def get_access_token(refresh_token):
    response = stack_auth_request('post', '/api/v1/auth/sessions/current/refresh',
        headers={'x-stack-refresh-token': refresh_token})
    return response['access_token']

user = get_user_object(get_access_token(refresh_token))
```

---

### Self-Hosting

Stack Auth is fully open-source and self-hostable. **You are responsible for updates, security patches, and infrastructure reliability.**

#### Services Required
| Service | Description |
|---------|-------------|
| API backend | Core REST API |
| Dashboard | Management UI |
| PostgreSQL | User data storage (Prisma ORM) |
| Svix | Webhook delivery |
| Email server | SMTP for emails |
| S3 storage | File storage |

#### Docker Quick Start

1. Start PostgreSQL:
```bash
docker run -d --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 postgres
```

2. Get the [example .env file](https://github.com/stack-auth/stack-auth/tree/main/docker/server/.env.example) and edit it (must change `STACK_SERVER_SECRET`)

3. Run Stack Auth:
```bash
docker run -d --name stack-auth --env-file .env -p 8101:8101 -p 8102:8102 stackauth/server
```

- Dashboard: `http://localhost:8101`
- API: `http://localhost:8102`

4. Set `NEXT_PUBLIC_STACK_API_URL=https://your-backend-url.com` in your app

#### Local Development
```bash
git clone https://github.com/stack-auth/stack-auth.git
cd stack-auth
pnpm install
pnpm run dev
```

Dev launchpad at `http://localhost:8100` with dashboard (8101), API (8102), demo (8103), docs (8104), Inbucket email (8105), Prisma Studio (8106).

---

## REST API Reference

Base URL: `https://api.stack-auth.com/api/v1/`

### Authentication Headers

| Header | Required | Description |
|--------|----------|-------------|
| `X-Stack-Access-Type` | Always | `client` or `server` |
| `X-Stack-Project-Id` | Always | Project UUID |
| `X-Stack-Publishable-Client-Key` | Client access | Publishable API key |
| `X-Stack-Secret-Server-Key` | Server access | Secret server key |
| `X-Stack-Access-Token` | Optional | Current user's access token |

#### Client vs. Server Access
- **Client**: For frontends. Can only access current user's data. Publishable key is safe to expose.
- **Server**: For backends. Full access to all data. Secret key must never be exposed.

### Key Endpoint Groups

#### Users
- `GET /users/me` — Get current user
- `PATCH /users/me` — Update current user
- `DELETE /users/me` — Delete current user
- `GET /users` — List all users (server)
- `POST /users` — Create user (server)
- `GET /users/{user_id}` — Get user by ID (server)
- `PATCH /users/{user_id}` — Update user (server)
- `DELETE /users/{user_id}` — Delete user (server)

#### Authentication
- `POST /auth/password/sign-in` — Email/password sign-in
- `POST /auth/password/sign-up` — Email/password sign-up
- `POST /auth/otp/send-sign-in-code` — Send magic link
- `POST /auth/otp/sign-in` — Sign in with code
- `POST /auth/password/send-reset-code` — Send password reset
- `POST /auth/password/reset` — Reset password
- `POST /auth/anonymous/sign-up` — Anonymous sign-up
- `POST /auth/mfa/sign-in` — MFA sign-in

#### Sessions
- `GET /auth/sessions` — List sessions
- `DELETE /auth/sessions/current` — Sign out
- `POST /auth/sessions/current/refresh` — Refresh access token
- `POST /auth/sessions` — Create session (server, impersonation)
- `DELETE /auth/sessions/{id}` — Delete session

#### Teams
- `GET /teams` — List teams
- `POST /teams` — Create team
- `GET /teams/{team_id}` — Get team
- `PATCH /teams/{team_id}` — Update team
- `DELETE /teams/{team_id}` — Delete team

#### Team Members & Invitations
- `GET /team-member-profiles` — List member profiles
- `GET /team-member-profiles/{team_id}/{user_id}` — Get member profile
- `PATCH /team-member-profiles/{team_id}/{user_id}` — Update member profile
- `POST /team-memberships/{team_id}/{user_id}` — Add user (server)
- `DELETE /team-memberships/{team_id}/{user_id}` — Remove user
- `GET /team-invitations` — List invitations
- `POST /team-invitations/send-code` — Send invitation email
- `POST /team-invitations/{id}/accept` — Accept invitation
- `DELETE /team-invitations/{id}` — Delete invitation

#### Permissions
- `GET /project-permissions` — List project permissions
- `GET /team-permissions` — List team permissions
- `POST /project-permissions/{user_id}/{permission_id}` — Grant project permission (server)
- `DELETE /project-permissions/{user_id}/{permission_id}` — Revoke project permission (server)
- `POST /team-permissions/{team_id}/{user_id}/{permission_id}` — Grant team permission (server)
- `DELETE /team-permissions/{team_id}/{user_id}/{permission_id}` — Revoke team permission (server)

#### Contact Channels
- `GET /contact-channels` — List contact channels
- `POST /contact-channels` — Create contact channel
- `POST /contact-channels/verify` — Verify email
- `GET /contact-channels/{user_id}/{id}` — Get channel
- `PATCH /contact-channels/{user_id}/{id}` — Update channel
- `DELETE /contact-channels/{user_id}/{id}` — Delete channel

#### OAuth
- `GET /oauth-providers` — List providers
- `GET /auth/oauth/authorize/{provider_id}` — Initiate OAuth flow
- `POST /auth/oauth/token` — Exchange token

#### API Keys
- `GET /user-api-keys` — List user API keys
- `POST /user-api-keys` — Create user API key
- `GET /team-api-keys` — List team API keys
- `POST /team-api-keys` — Create team API key

#### Emails (Server)
- `POST /emails/send-email` — Send email
- `GET /emails/outbox` — List outbox
- `GET /emails/delivery-info` — Delivery stats

#### Payments
- `POST /payments/purchases/create-purchase-url` — Create checkout URL
- `GET /payments/items/{customer_type}/{customer_id}/{item_id}` — Get item
- `POST /payments/items/{customer_type}/{customer_id}/{item_id}/update-quantity` — Update quantity (server)

### Error Codes
| Code | Description |
|------|-------------|
| `400` | Bad Request — Invalid parameters |
| `401` | Unauthorized — Invalid/missing auth |
| `403` | Forbidden — Insufficient permissions |
| `404` | Not Found — Resource not found |
| `429` | Too Many Requests — Rate limited |
| `500` | Internal Server Error |

---

## SDK Reference

### Objects
| Object | Description |
|--------|-------------|
| `StackClientApp` | Client-side app instance (publishable key) |
| `StackServerApp` | Server-side app instance (extends client, secret key) |

### Hooks
| Hook | Description |
|------|-------------|
| `useStackApp()` | Returns the `StackClientApp` instance |
| `useUser()` | Returns the current user (shorthand for `useStackApp().useUser()`) |

### Types

#### User Types
| Type | Description |
|------|-------------|
| `CurrentUser` | Current authenticated user (client) |
| `ServerUser` | User with server-only fields and methods |
| `CurrentServerUser` | Current user with server fields |

#### Team Types
| Type | Description |
|------|-------------|
| `Team` | Team object (client) |
| `ServerTeam` | Team with server-only methods |
| `TeamPermission` / `ServerTeamPermission` | Permission objects |
| `TeamUser` / `ServerTeamUser` | Team member objects |
| `TeamProfile` / `ServerTeamProfile` | Team profile objects |

#### Other Types
| Type | Description |
|------|-------------|
| `Project` | Project configuration |
| `ContactChannel` / `ServerContactChannel` | Contact channel objects |
| `ConnectedAccount` | OAuth connected account |
| `ApiKey` | API key object |
| `Customer` | Payment customer interface |
| `Item` / `ServerItem` | Payment item types |
| `SendEmailOptions` | Email sending configuration |

---

## FAQ

**What languages are supported?**
TypeScript and JavaScript for frontends. Any language via the REST API for backends.

**Can I use Stack with other JS frameworks (Astro, Angular)?**
Yes — use the vanilla JavaScript SDK, or the React SDK for React-based frameworks.

**Can I use Stack with the Next.js Pages Router?**
Only the App Router is officially supported. Community members have used the React/JS SDKs with Pages Router.

**Can I migrate my existing userbase?**
Yes — create users programmatically via the REST API (`POST /users`).

**How can I contribute?**
See [CONTRIBUTING.md](https://github.com/stack-auth/stack-auth/blob/dev/CONTRIBUTING.md).

**How does Stack Auth compare to alternatives?**
Stack Auth is open-source, developer-friendly with quick setup, and provides authentication + authorization + user management in one platform.

---

*Documentation source: https://docs.stack-auth.com*
