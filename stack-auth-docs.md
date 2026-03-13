# Stack Auth - Complete Documentation Reference

> Open-source authentication that gets you started in minutes.
> Source: https://docs.stack-auth.com/docs/overview

---

## Table of Contents

- [Overview](#overview)
- [FAQ](#faq)
- [Getting Started](#getting-started)
  - [Setup & Installation](#setup--installation)
  - [Users](#users)
  - [Components Guide](#components-guide)
  - [Going to Production](#going-to-production)
  - [Vite JavaScript Example](#vite-javascript-example)
- [Concepts](#concepts)
  - [Stack App](#stack-app)
  - [Backend Integration](#backend-integration)
  - [Custom User Data](#custom-user-data)
  - [JWT Tokens](#jwt-tokens)
  - [Sign-up Rules](#sign-up-rules)
  - [Team Selection](#team-selection)
  - [User Onboarding](#user-onboarding)
- [Auth Providers](#auth-providers)
  - [Overview](#auth-providers-overview)
  - [Google](#google)
  - [GitHub](#github)
  - [Passkey](#passkey)
  - [Two-Factor Authentication (2FA)](#two-factor-authentication-2fa)
  - [Other Providers](#other-oauth-providers)
- [Apps](#apps)
  - [Analytics](#analytics)
  - [API Keys](#api-keys)
  - [Emails](#emails)
  - [OAuth (Connected Accounts)](#oauth-connected-accounts)
  - [Orgs and Teams](#orgs-and-teams)
  - [Payments](#payments)
  - [RBAC Permissions](#rbac-permissions)
  - [Webhooks](#webhooks)
- [Customization](#customization)
  - [Custom Pages](#custom-pages)
  - [Custom Styles](#custom-styles)
  - [Dark Mode](#dark-mode)
  - [Internationalization](#internationalization)
- [SDK Reference](#sdk-reference)
  - [SDK Overview](#sdk-overview)
  - [StackClientApp](#stackclientapp)
  - [StackServerApp](#stackserverapp)
  - [Hooks](#hooks)
  - [User Types](#user-types)
  - [Team Types](#team-types)
- [Components Reference](#components-reference)
- [REST API](#rest-api)
- [Integrations](#integrations)
  - [Convex](#convex)
  - [Supabase](#supabase)
  - [CLI Authentication](#cli-authentication)
  - [MCP Setup](#mcp-setup)
- [Self-Hosting](#self-hosting)

---

## Overview

Stack Auth is an open-source authentication and user management platform. It provides:

- **Authentication**: Email/password, magic link/OTP, OAuth (Google, GitHub, Facebook, Microsoft, etc.), passkeys, and 2FA
- **User Management**: User profiles, custom metadata, onboarding flows
- **Teams/Organizations**: Multi-tenant team management with RBAC permissions
- **Pre-built UI Components**: Drop-in React/Next.js components for sign-in, sign-up, user management
- **REST API**: Full REST API for any language or framework
- **Apps**: API keys, emails, payments (Stripe), analytics, webhooks

### Quick Start (Next.js)

**1. Install the SDK**

```bash
npx @stackframe/stack-cli@latest init
```

**2. Use authentication**

```tsx
import { useUser } from "@stackframe/stack";

export default function Page() {
  const user = useUser();
  return <div>{user ? `Hello, ${user.displayName}` : "Not signed in"}</div>;
}
```

For other frameworks or detailed configuration, see the [full setup guide](#setup--installation).

---

## FAQ

### What languages are supported?

For frontends, Stack supports TypeScript and JavaScript. For backends, Stack has a flexible REST API that can be used with any language or framework.

### Can I use Stack with other JavaScript frameworks, like Astro or Angular?

Yes! You can use the vanilla JavaScript SDK, or, if the framework is React-based, the React SDK.

### Can I use Stack with the Next.js pages router?

Only the Next.js app router is currently officially supported, although some community members have successfully used the React or vanilla JavaScript SDKs with the pages router.

### How do you compare to other auth solutions?

Stack Auth differentiates itself by being:
- Open-source
- Developer-friendly with quick setup
- Providing both authentication AND authorization + user management

### Can I migrate my existing userbase?

Yes! You can create users programmatically using the REST API.

---

## Getting Started

### Setup & Installation

#### Prerequisites

- **Next.js**: A Next.js project using the app router
- **React**: A React project (e.g., with Vite)
- **JavaScript**: A Node.js project with Express
- **Python**: A Python environment with Django, FastAPI, or Flask

#### Setup Wizard (Recommended for JS)

**Step 1: Run installation wizard**

```bash
npx @stackframe/stack-cli@latest init
```

**Step 2: Update API keys**

Create an account on the [Stack Auth dashboard](https://app.stack-auth.com/projects), create a new project with an API key, and copy its environment variables into your `.env.local`:

```env
NEXT_PUBLIC_STACK_PROJECT_ID=your-project-id
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=your-publishable-key
STACK_SECRET_SERVER_KEY=your-secret-key
```

**Step 3: Done!**

The wizard creates/updates these files:

**For Next.js:**
- `app/handler/[...stack]/page.tsx` — Default pages for sign-in, sign-out, account settings
- `app/layout.tsx` — Updated to wrap the body with `StackProvider` and `StackTheme`
- `app/loading.tsx` — Suspense boundary for async hooks
- `stack/server.ts` — Contains `stackServerApp` for server-side usage
- `stack/client.ts` — Contains `stackClientApp` for client-side usage

**For React:**
- `stack/client.ts` — Contains `stackClientApp` configuration
- Your app should be wrapped with `StackProvider` and `StackTheme`

**For Node.js/Express:**
- `stack/server.ts` — Contains `stackServerApp` configuration

#### Manual Installation

**Step 1: Install package**

```bash
# Next.js
npm install @stackframe/stack

# React
npm install @stackframe/react

# JavaScript (vanilla)
npm install @stackframe/js
```

**Step 2: Create API keys**

Register on [Stack Auth](https://app.stack-auth.com/handler/sign-up), create a project, create an API key, and copy the project ID, publishable client key, and secret server key.

**Step 3: Configure environment variables**

```env
NEXT_PUBLIC_STACK_PROJECT_ID=your-project-id
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=pck_your-key
STACK_SECRET_SERVER_KEY=ssk_your-key
```

**Step 4: Create Stack configuration**

```typescript
// stack/server.ts
import { StackServerApp } from "@stackframe/stack";

export const stackServerApp = new StackServerApp({
  tokenStore: "nextjs-cookie",
});
```

**Step 5: Set up authentication handlers (Next.js)**

```tsx
// app/handler/[...stack]/page.tsx
import { StackHandler } from "@stackframe/stack";
import { stackServerApp } from "@/stack/server";

export default function Handler(props: any) {
  return <StackHandler fullPage app={stackServerApp} {...props} />;
}
```

**Step 6: Add providers (Next.js/React)**

```tsx
// app/layout.tsx
import { StackProvider, StackTheme } from "@stackframe/stack";
import { stackServerApp } from "@/stack/server";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <StackProvider app={stackServerApp}>
          <StackTheme>
            {children}
          </StackTheme>
        </StackProvider>
      </body>
    </html>
  );
}
```

**Step 7: Add loading boundary (Next.js)**

```tsx
// app/loading.tsx
export default function Loading() {
  return null;
}
```

---

### Users

#### Client Component Basics

The `useUser()` hook returns the current user in a Client Component:

```tsx
"use client";
import { useUser } from "@stackframe/stack";

export function MyClientComponent() {
  const user = useUser();
  return <div>{user ? `Hello, ${user.displayName ?? "anon"}` : "You are not logged in"}</div>;
}
```

To redirect if not signed in:

```tsx
const user = useUser({ or: "redirect" });
return <div>{`Hello, ${user.displayName ?? "anon"}`}</div>;
```

#### Server Component Basics

```tsx
import { stackServerApp } from "@/stack/server";

export default async function MyServerComponent() {
  const user = await stackServerApp.getUser();
  return <div>{user ? `Hello, ${user.displayName ?? "anon"}` : "You are not logged in"}</div>;
}
```

> `useUser()` re-renders on user changes (e.g., signout), while `getUser()` only fetches once on page load.

#### Protecting a Page

**Client Component:**

```tsx
"use client";
import { useUser } from "@stackframe/stack";

export default function MyProtectedPage() {
  useUser({ or: "redirect" });
  return <h1>You can only see this if you are logged in</h1>;
}
```

**Server Component:**

```tsx
import { stackServerApp } from "@/stack/server";

export default async function MyProtectedPage() {
  await stackServerApp.getUser({ or: "redirect" });
  return <h1>You can only see this if you are logged in</h1>;
}
```

**Middleware:**

```tsx
// middleware.tsx
export async function middleware(request: NextRequest) {
  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/handler/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/protected/:path*",
};
```

> **Security Note**: Client components are always sent to the browser regardless of protection. For sensitive information, protect at the server component level. Every component with sensitive data should protect itself.

#### Updating User Data

```tsx
"use client";
import { useUser } from "@stackframe/stack";

export default function MyComponent() {
  const user = useUser();
  return (
    <button onClick={async () => await user.update({ displayName: "New Name" })}>
      Change Name
    </button>
  );
}
```

#### Signing Out

```tsx
"use client";
import { useUser } from "@stackframe/stack";

export default function SignOutButton() {
  const user = useUser();
  return user ? <button onClick={() => user.signOut()}>Sign Out</button> : "Not signed in";
}
```

Or redirect to `/handler/sign-out`.

#### Example: Custom Profile Page

```tsx
"use client";
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

### Components Guide

Stack Auth provides pre-built React/Next.js components:

#### `<UserButton />`

Shows the user's avatar with a dropdown for user settings.

```tsx
import { UserButton } from "@stackframe/stack";

export default function Page() {
  return <UserButton />;
}
```

#### `<SignIn />` and `<SignUp />`

Pre-built sign-in and sign-up forms.

```tsx
import { SignIn } from "@stackframe/stack";

export default function Page() {
  return <SignIn />;
}
```

The `<SignIn />` component is composed of:
- `<OAuthButtonGroup />` (multiple `<OAuthButton />` components)
- `<MagicLinkSignIn />` (text field, calls `useStackApp().signInWithMagicLink()`)
- `<CredentialSignIn />` (two text fields, calls `useStackApp().signInWithCredential()`)

You can use these sub-components individually for custom sign-in flows.

#### Full Component List

**Sign In and Sign Up:**
- `<SignIn />` — Full sign-in form
- `<SignUp />` — Full sign-up form
- `<CredentialSignIn />` — Email/password sign-in
- `<CredentialSignUp />` — Email/password sign-up
- `<OAuthButton />` — Single OAuth provider button
- `<OAuthButtonGroup />` — Group of OAuth buttons
- `<MagicLinkSignIn />` — Magic link sign-in
- `<ForgotPassword />` — Forgot password form
- `<PasswordReset />` — Password reset form

**User:**
- `<UserButton />` — User avatar with dropdown
- `<AccountSettings />` — Full account settings page

**Teams:**
- `<SelectedTeamSwitcher />` — Team selector/switcher

**Utilities:**
- `<StackHandler />` — Handles all auth routes
- `<StackProvider />` — Provides Stack context
- `<StackTheme />` — Provides theming context

---

### Going to Production

#### Domains

Add your production domain in the `Domain & Handlers` tab in the Stack dashboard. Disable `Allow all localhost callbacks for development`.

#### OAuth Providers

Replace shared OAuth keys with your own. For each provider:

1. Create an OAuth App on the provider's website
2. Set the callback URL:
   - Google: `https://api.stack-auth.com/api/v1/auth/oauth/callback/google`
   - GitHub: `https://api.stack-auth.com/api/v1/auth/oauth/callback/github`
   - Facebook: `https://api.stack-auth.com/api/v1/auth/oauth/callback/facebook`
   - Microsoft: `https://api.stack-auth.com/api/v1/auth/oauth/callback/microsoft`
   - Spotify: `https://api.stack-auth.com/api/v1/auth/oauth/callback/spotify`
   - GitLab: `https://api.stack-auth.com/api/v1/auth/oauth/callback/gitlab`
   - Bitbucket: `https://api.stack-auth.com/api/v1/auth/oauth/callback/bitbucket`
   - LinkedIn: `https://api.stack-auth.com/api/v1/auth/oauth/callback/linkedin`
   - X (Twitter): `https://api.stack-auth.com/api/v1/auth/oauth/callback/x`
3. Enter client ID and secret in Stack dashboard under `Auth Methods`

#### Email Server

Configure your own SMTP server:
1. Set up your email server connected to your domain
2. In Stack dashboard → Emails → Email Server → switch from Shared to Custom SMTP server
3. Enter your SMTP configurations

#### Enable Production Mode

After completing the above steps, enable production mode on the `Project Settings` tab.

---

### Vite JavaScript Example

Stack Auth works with Vite and other vanilla JavaScript frameworks. See the [GitHub example](https://github.com/stack-auth/stack-auth/tree/main/examples/js-example) for complete code.

---

## Concepts

### Stack App

The `StackApp` is the core "connection" object from your code to Stack's servers. Each app is associated with one project ID.

#### `getXyz`/`listXyz` vs. `useXyz`

- `getXyz`/`listXyz` — Asynchronous functions returning a `Promise` (use in Server Components)
- `useXyz` — React hooks that suspend the component until data is available (use in Client Components)

```tsx
// Server Component
async function ServerComponent() {
  const user = await stackServerApp.getUser(); // Promise
  return <div>{user.displayName}</div>;
}

// Client Component
"use client";
function ClientComponent() {
  const app = useStackApp();
  const user = app.useUser(); // Returns value directly
  return <div>{user.displayName}</div>;
}
```

#### Client vs. Server

| Type | Description | Key Required |
|------|-------------|-------------|
| `StackClientApp` | Frontend operations, current user only | Publishable client key (`NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY`) |
| `StackServerApp` | Full access, all users, elevated permissions | Secret server key (`STACK_SECRET_SERVER_KEY`) — **keep secret** |
| `StackAdminApp` | Project configuration, rarely used | Super admin key |

---

### Backend Integration

To authenticate your own server endpoints using Stack Auth:

#### Sending Requests from Client

```typescript
const { accessToken } = await user.getAuthJson();
const response = await fetch("/api/users/me", {
  headers: {
    "x-stack-access-token": accessToken,
  },
});
```

#### Server-Side Verification

**Method 1: JWT Verification (Fast, Local)**

```javascript
// Node.js
import * as jose from "jose";

const jwks = jose.createRemoteJWKSet(
  new URL("https://api.stack-auth.com/api/v1/projects/<your-project-id>/.well-known/jwks.json")
);

try {
  const { payload } = await jose.jwtVerify(accessToken, jwks);
  console.log("Authenticated user with ID:", payload.sub);
} catch (error) {
  console.log("Invalid user");
}
```

```python
# Python
import jwt
from jwt import PyJWKClient

jwks_client = PyJWKClient(
    "https://api.stack-auth.com/api/v1/projects/<your-project-id>/.well-known/jwks.json"
)

try:
    signing_key = jwks_client.get_signing_key_from_jwt(access_token)
    payload = jwt.decode(access_token, signing_key.key, algorithms=["ES256"], audience="<your-project-id>")
    print("Authenticated user with ID:", payload["sub"])
except Exception as error:
    print("Invalid user")
```

**Method 2: REST API Verification (Full User Info)**

```javascript
const response = await fetch("https://api.stack-auth.com/api/v1/users/me", {
  headers: {
    "x-stack-access-type": "server",
    "x-stack-project-id": "your-project-id",
    "x-stack-secret-server-key": "your-secret-key",
    "x-stack-access-token": accessToken,
  },
});
```

---

### Custom User Data

Stack Auth stores additional user information through three metadata fields:

| Field | Client Read | Client Write | Server Read | Server Write |
|-------|------------|-------------|------------|-------------|
| `clientMetadata` | Yes | Yes | Yes | Yes |
| `serverMetadata` | No | No | Yes | Yes |
| `clientReadOnlyMetadata` | Yes | No | Yes | Yes |

#### Client Metadata

```tsx
await user.update({
  clientMetadata: {
    mailingAddress: "123 Main St",
  },
});

// Read on client
const user = useUser();
console.log(user.clientMetadata);
```

#### Server Metadata

```tsx
const user = await stackServerApp.getUser();
await user.update({
  serverMetadata: {
    secretInfo: "This is a secret",
  },
});
```

#### Client Read-Only Metadata

```tsx
// Server: write
const user = await stackServerApp.getUser();
await user.update({
  clientReadOnlyMetadata: {
    subscriptionPlan: "premium",
  },
});

// Client: read only
const user = useUser();
console.log(user.clientReadOnlyMetadata);
```

---

### JWT Tokens

Stack Auth uses JWTs (ES256 algorithm) for secure authentication.

#### JWT Structure

**Header:**
- `alg`: Always `ES256`
- `kid`: Identifies which JWKS public key to use

**Standard Claims:**
- `iss` (Issuer): `https://api.stack-auth.com/api/v1/projects/<project-id>`
- `sub` (Subject): The user ID
- `aud` (Audience): `<project-id>`
- `exp` (Expiration): Unix timestamp
- `iat` (Issued At): Unix timestamp

**Stack Auth Specific Claims:**
- `project_id`: Your Stack Auth project ID
- `branch_id`: Project branch (currently always `main`)
- `refresh_token_id`: ID of the associated refresh token
- `role`: Always `authenticated` for valid users
- `name`: User's display name (nullable)
- `email`: User's primary email (nullable)
- `email_verified`: Whether email has been verified
- `selected_team_id`: Currently selected team ID (nullable)
- `is_anonymous`: Whether this is an anonymous session
- `is_restricted`: Whether the user is restricted
- `restricted_reason`: Why the user is restricted (nullable)

#### Example JWT Payload

```json
{
  "iss": "https://api.stack-auth.com/api/v1/projects/project_abcdef",
  "sub": "user_123456",
  "aud": "project_abcdef",
  "exp": 1735689600,
  "iat": 1735603200,
  "project_id": "project_abcdef",
  "role": "authenticated",
  "name": "John Doe",
  "email": "john@example.com",
  "email_verified": true,
  "selected_team_id": "team_789",
  "is_anonymous": false,
  "is_restricted": false
}
```

#### Anonymous User Tokens

- `iss`: `https://api.stack-auth.com/api/v1/projects-anonymous-users/<project-id>`
- `aud`: `<project-id>:anon`
- `is_anonymous`: `true`
- `is_restricted`: `true`

#### Restricted User Tokens

- `iss`: `https://api.stack-auth.com/api/v1/projects-restricted-users/<project-id>`
- `aud`: `<project-id>:restricted`
- `is_restricted`: `true`
- `restricted_reason`: `{ "type": "email_not_verified" }` or `{ "type": "restricted_by_administrator" }`

#### Security Best Practices

- Never store JWTs in `localStorage` for sensitive applications
- Use secure, httpOnly cookies when possible
- JWTs have a 10-minute lifetime by default; Stack auto-refreshes
- Always verify JWT signatures using the public key
- Always transmit JWTs over HTTPS

---

### Sign-up Rules

Control who can sign up with customizable rules evaluated during sign-up.

#### Creating Rules

Navigate to **Sign-up Rules** in your project dashboard:
1. Click **Add Rule**
2. Enter a name
3. Configure conditions
4. Select an action (Allow, Reject, Restrict, or Log)

#### Available Conditions

| Variable | Type | Description |
|----------|------|-------------|
| `email` | string | User's email (normalized to lowercase) |
| `emailDomain` | string | Domain part of email (after @) |
| `authMethod` | string | `password`, `otp`, `oauth`, or `passkey` |
| `oauthProvider` | string | OAuth provider ID if using OAuth |

**Operations:** `contains()`, `startsWith()`, `endsWith()`, `matches()` (regex), `==`, `!=`

#### Actions

| Action | Description |
|--------|-------------|
| **Allow** | User signs up normally |
| **Reject** | Blocks sign-up with message |
| **Restrict** | User signs up but account is marked restricted |
| **Log** | Triggered and logged, no action taken |

#### Common Use Cases

**Block disposable emails:**
- Condition: `emailDomain.matches("(tempmail|throwaway|guerrillamail)\\..*")`
- Action: Reject

**Allow only corporate domains:**
1. Set default action to **Reject**
2. Create allow rule: `emailDomain == "company1.com" || emailDomain == "company2.com"`

---

### Team Selection

Two methods for selecting a "current team":

#### Deep Link Method (Recommended)

Each team has a unique URL: `your-website.com/team/<team-id>`. Avoids issues with shared links showing wrong team data.

#### Current Team Method

Global "current team" state. Simpler but can cause issues with shared links or multiple tabs.

#### SelectedTeamSwitcher Component

```jsx
import { SelectedTeamSwitcher } from "@stackframe/stack";

// Basic usage (current team method)
<SelectedTeamSwitcher />

// Deep link method
<SelectedTeamSwitcher
  urlMap={team => `/team/${team.id}`}
  selectedTeam={team}
/>

// Deep link + default team (no auto-update of selectedTeam)
<SelectedTeamSwitcher
  urlMap={team => `/team/${team.id}`}
  selectedTeam={team}
  noUpdateSelectedTeam
/>
```

---

### User Onboarding

Store an `onboarded` flag in user metadata and redirect users to onboarding if they haven't completed it.

#### Example Implementation

```jsx
// app/onboarding/page.tsx
export default function OnboardingPage() {
  const user = useUser();
  const router = useRouter();
  const [address, setAddress] = useState("");

  return (
    <>
      <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} />
      <button onClick={async () => {
        await user.update({
          clientMetadata: { onboarded: true, address },
        });
        router.push("/");
      }}>
        Submit
      </button>
    </>
  );
}
```

#### Client Hook for Onboarding Check

```jsx
"use client";
import { useEffect } from "react";
import { useUser } from "@stackframe/stack";
import { useRouter } from "next/navigation";

export function useOnboarding() {
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!user.clientReadOnlyMetadata.onboarded) {
      router.push("/onboarding");
    }
  }, [user]);
}
```

#### Server Function for Onboarding Check

```tsx
import { stackServerApp } from "@/stack/server";
import { redirect } from "next/navigation";

export async function ensureOnboarded() {
  const user = await stackServerApp.getUser();
  if (!user.clientReadOnlyMetadata.onboarded) {
    redirect("/onboarding");
  }
}
```

> **Tip:** Use `clientReadOnlyMetadata` instead of `clientMetadata` for the `onboarded` flag to prevent users from bypassing onboarding via API.

---

## Auth Providers

### Auth Providers Overview

Stack Auth supports a wide range of authentication providers:

**OAuth Providers:** GitHub, Google, Facebook, Microsoft, Spotify, Discord, GitLab, Apple, Bitbucket, LinkedIn, X (Twitter), Twitch

**Other Methods:** Passkey, Two-Factor Authentication (2FA)

Each provider can use shared keys (for development) or custom keys (required for production).

---

### Google

1. Navigate to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project → **APIs & Services** → **Credentials**
3. Click **Create Credentials** → **OAuth client ID** → **Web application**
4. Add Authorized redirect URI: `https://api.stack-auth.com/api/v1/auth/oauth/callback/google`
5. Save Client ID and Client Secret
6. In Stack dashboard → **Auth Methods** → Add Google → enter credentials

---

### GitHub

1. Navigate to [GitHub Developer App Settings](https://github.com/settings/apps)
2. Click **New GitHub App**
3. Set callback URL: `https://api.stack-auth.com/api/v1/auth/oauth/callback/github`
4. Set **Account Permissions > Email Addresses** to **Read Only** (minimum required)
5. Select **Any Account** for installation
6. Save Client ID and generate Client Secret
7. In Stack dashboard → **Auth Methods** → Add GitHub → enter credentials

---

### Passkey

Passkeys allow users to sign in using biometrics, mobile devices, or security keys (WebAuthn standard).

**Setup:**
1. In Stack dashboard → **Auth Methods** → Enable **Passkey**
2. Use built-in `<SignIn />` component (automatically shows passkey option)

**How it works:**
1. **Registration**: Device generates public-private key pair; public key goes to Stack Auth
2. **Authentication**: Stack sends challenge → device signs with private key → Stack verifies
3. **Cross-device**: Users can use QR codes or nearby device detection

---

### Two-Factor Authentication (2FA)

Uses TOTP (Time-based One-Time Password), compatible with Google Authenticator, Microsoft Authenticator, Authy, etc.

**No developer configuration required** — 2FA is enabled by default at the platform level.

Users enable 2FA through the `<AccountSettings />` component, which handles QR code generation, verification, and recovery codes.

---

### Other OAuth Providers

All OAuth providers follow the same pattern:
1. Create an OAuth app on the provider's platform
2. Set the callback URL to `https://api.stack-auth.com/api/v1/auth/oauth/callback/<provider>`
3. Enter credentials in Stack dashboard → **Auth Methods**

Supported: Facebook, Microsoft, Spotify, Discord, GitLab, Apple, Bitbucket, LinkedIn, X (Twitter), Twitch

---

## Apps

### Analytics

Access your project's analytics dataset with tables, SQL queries, and session replays.

#### Features

- **Tables**: Browse event rows with sorting, search, incremental loading
- **Queries**: Run and save reusable ClickHouse SQL queries
- **Replays**: Watch session replays filtered by user, team, duration, activity, click count

#### Enabling

Dashboard → **Apps** → **Analytics** → **Enable**

#### Tracked Events

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

### API Keys

Enable users and teams to generate API keys for programmatic access.

#### Types

- **User API keys**: Associated with individual users
- **Team API keys**: Associated with teams

#### Enabling

Dashboard → **Apps** → **API Keys** → **Enable**

#### Prebuilt UI

The `<AccountSettings>` component includes an API Keys tab. Team settings pages include API Keys when enabled and the user has `$manage_api_keys` permission.

#### Validating API Keys on Server

```typescript
// User API key
const user = await stackServerApp.getUser({ apiKey: apiKeyFromRequest });

// Team API key
const team = await stackServerApp.getTeam({ apiKey: apiKeyFromRequest });
```

#### Best Practices

1. Always use HTTPS in production
2. Validate on every request
3. Use appropriate headers (`X-Stack-Api-Key`, `Authorization: Bearer <key>`)
4. Implement rate limiting
5. Monitor usage for anomalies

---

### Emails

Send custom emails to users with Stack Auth's email system.

#### Email Types

- **Transactional**: Required for app usage, cannot be opted out
- **Marketing**: Always contain unsubscribe link

> Never send marketing emails as transactional — this can get your domain blacklisted.

#### Sending Emails

```typescript
import { stackServerApp } from "./stack";

// Custom HTML email
const result = await stackServerApp.sendEmail({
  userIds: ["user-id-1", "user-id-2"],
  subject: "Welcome to our platform!",
  html: "<h1>Welcome!</h1><p>Thanks for joining us.</p>",
});

// Template-based email
const result = await stackServerApp.sendEmail({
  userIds: ["user-id"],
  templateId: "welcome-template",
  subject: "Welcome!",
  variables: {
    userName: "John Doe",
    activationUrl: "https://yourapp.com/activate/token123",
  },
});
```

#### SendEmail Options

```typescript
type SendEmailOptions = {
  userIds: string[];
  themeId?: string | null | false;
  subject?: string;
  notificationCategoryName?: string;
  html?: string;
  templateId?: string;
  variables?: Record<string, any>;
};
```

#### Built-in Templates

- `email_verification` — Email verification
- `password_reset` — Password reset
- `magic_link` — Passwordless authentication
- `team_invitation` — Team invitations
- `sign_in_invitation` — Sign-up invitations
- `payment_receipt` — Payment success
- `payment_failed` — Payment failure

#### Error Handling

```typescript
const result = await stackServerApp.sendEmail({ ... });

if (result.status === "error") {
  switch (result.error.code) {
    case "REQUIRES_CUSTOM_EMAIL_SERVER": break;
    case "SCHEMA_ERROR": break;
    case "USER_ID_DOES_NOT_EXIST": break;
  }
}
```

#### Email Configuration

- **Development**: Use Stack's shared email provider (sends from `noreply@stackframe.co`)
- **Production**: Configure custom SMTP server (Host, Port, Username, Password, Sender Email, Sender Name)

#### Notification Categories

```typescript
await stackServerApp.sendEmail({
  userIds: ["user-id"],
  html: "<p>New feature available!</p>",
  subject: "Product Updates",
  notificationCategoryName: "product_updates",
});
```

Users can opt in/out via account settings.

---

### OAuth (Connected Accounts)

Beyond sign-in, Stack manages users' OAuth access tokens so you can invoke APIs on their behalf (e.g., Gmail, GitHub, OneDrive).

> Requires your own OAuth client ID/secret (not shared keys).

#### Connecting with OAuth Providers

```jsx
"use client";
import { useUser } from "@stackframe/stack";

export default function Page() {
  const user = useUser({ or: "redirect" });
  const account = user.useConnectedAccount("google", { or: "redirect" });
  return <div>Google account connected</div>;
}
```

#### Providing Scopes

```jsx
const account = user.useConnectedAccount("google", {
  or: "redirect",
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});
```

#### Retrieving Access Tokens

```jsx
const { accessToken } = account.useAccessToken();

// Use with provider APIs
fetch("https://www.googleapis.com/drive/v3/files", {
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

#### Sign-in Default Scopes

```typescript
export const stackServerApp = new StackServerApp({
  oauthScopesOnSignIn: {
    google: ["https://www.googleapis.com/auth/drive.readonly"],
  },
});
```

#### Account Merging Strategies

- **Link** (new default): Links OAuth identity to existing account if both verified
- **Allow** (legacy default): Creates separate account for same email
- **Block**: Raises error if OAuth matches existing account

---

### Orgs and Teams

Teams group users and manage permissions. Users can belong to multiple teams.

#### Retrieving Teams

```tsx
// Client
const user = useUser({ or: "redirect" });
const allTeams = user.useTeams();
const someTeam = user.useTeam("some-team-id");

// Server
const user = await stackServerApp.getUser({ or: "redirect" });
const allTeams = await user.listTeams();
const someTeam = await user.getTeam("some-team-id");
```

#### Creating Teams

```tsx
// Client (requires "client side team creation" enabled in dashboard)
const team = await user.createTeam({ displayName: "New Team" });

// Server (without adding a user)
const team = await stackServerApp.createTeam({ displayName: "New Team" });
```

#### Updating Teams

```tsx
await team.update({
  displayName: "New Name",
});
```

Requires `$update_team` permission on client.

#### Custom Team Metadata

Same pattern as user metadata:
- `clientMetadata`: Read/write on client and server
- `serverMetadata`: Read/write on server only
- `clientReadOnlyMetadata`: Read on client, write on server

#### List Users in a Team

```tsx
// Client (requires $read_members permission)
const users = team.useUsers();

// Server
const users = await team.listUsers();
```

#### Team Profiles

Users can have a different profile per team (`displayName`, `profileImageUrl`). Falls back to personal profile if empty.

```tsx
const teamProfile = user.useTeamProfile(team); // client
const teamProfile = await user.getTeamProfile(team); // server
```

#### Invite, Add, Remove Users

```tsx
await team.inviteUser(email);          // Sends email invitation
await team.addUser(user.id);           // Server only, no email
await team.removeUser(user.id);        // Requires $remove_members permission
await user.leaveTeam(team);            // Any user can leave
await team.delete();                   // Requires $delete_team permission
```

---

### Payments

Stripe integration for billing, subscriptions, and one-time purchases.

#### Quick Setup

1. Enable Payments app in dashboard
2. Connect Stripe in **Payments → Settings**
3. Create product lines and products
4. Generate checkout URLs in your app
5. Use test mode for development

> Currently only available for US-based businesses.

#### Core Concepts

- **Product**: A sellable offer (one-time or subscription)
- **Product line**: Mutually exclusive set of products (customer can only have one active)
- **Item**: Quantifiable entitlement (credits, seats, API calls)
- **Customer**: Owner of purchases (`user`, `team`, or `custom`)

#### Creating Checkout URLs

```tsx
// User checkout
const checkoutUrl = await user.createCheckoutUrl({ productId: "prod_123" });
window.location.href = checkoutUrl;

// Team checkout
const checkoutUrl = await team.createCheckoutUrl({ productId: "prod_team_seats" });
```

#### Managing Items

```tsx
// Get item quantity
const credits = await user.getItem("credits");
console.log(`${credits.quantity} credits remaining`);

// React hook (real-time)
const credits = user.useItem("credits");

// Consume credits (server-side, atomic/race-condition-safe)
const result = await serverItem.tryDecreaseQuantity(1);
```

> Always use `tryDecreaseQuantity()` instead of checking balance then decreasing — prevents race conditions.

#### Customer Types

- **Users**: Individual user accounts
- **Teams**: Team/organization accounts
- **Custom Customers**: External entities with custom IDs

#### Test Mode

Enable in **Payments → Settings**. All purchases will be free. Test card numbers:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Insufficient Funds: `4000 0000 0000 9995`

#### Payment Emails

Automatic notifications:
- **Payment Receipt**: On successful payment
- **Payment Failed**: On failed payment

#### Pricing

Stack Auth charges no additional fees. You only pay Stripe's standard processing fees.

---

### RBAC Permissions

Control what each user can do with two permission types:

#### Team Permissions

Control actions within a specific team. Create in the `Team Permissions` section of the dashboard.

**System Permissions** (start with `$`, cannot be modified):
- `$read_members`
- `$invite_members`
- `$remove_members`
- `$update_team`
- `$delete_team`
- `$manage_api_keys`

**Checking Permissions:**

```tsx
// Client
const permission = user.usePermission(team, "read");

// Server (always use server-side for business logic)
const permission = await user.getPermission(team, "read");
```

**Listing Permissions:**

```tsx
const permissions = user.usePermissions(); // client
const permissions = await user.listPermissions(); // server
```

**Granting/Revoking:**

```tsx
await user.grantPermission(team, "read");
await user.revokePermission(team, "read");
```

#### Project Permissions

Global permissions across the entire project (e.g., premium plans, global admin).

```tsx
// Check
const permission = user.usePermission("access_admin_dashboard"); // client
const permission = await user.getPermission("access_admin_dashboard"); // server

// Grant/Revoke
await user.grantPermission("access_admin_dashboard");
await user.revokePermission("access_admin_dashboard");
```

Permissions support arbitrary nesting for hierarchical structures (e.g., `admin` includes `moderator` and `user`).

> Always perform permission checks on the server side for business logic — client-side checks can be bypassed.

---

### Webhooks

Receive real-time updates when events occur in your Stack project.

#### Setup

Create a webhook endpoint in the Stack dashboard "Webhooks" section with your server URL.

#### Event Payload

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

Use the Svix client library:

```javascript
import { Webhook } from "svix";

const secret = "<from the dashboard>";
const headers = {
  "svix-id": "<from request headers>",
  "svix-timestamp": "<from request headers>",
  "svix-signature": "<from request headers>",
};
const payload = "<request body>";

const wh = new Webhook(secret);
const verifiedPayload = wh.verify(payload, headers);
```

#### Event Types

| Event | Description |
|-------|-------------|
| `user.created` | User created |
| `user.updated` | User updated |
| `user.deleted` | User deleted |
| `team.created` | Team created |
| `team.updated` | Team updated |
| `team.deleted` | Team deleted |
| `team_membership.created` | User added to team |
| `team_membership.deleted` | User removed from team |
| `team_permission.created` | Team permission created |
| `team_permission.deleted` | Team permission deleted |

#### Testing Locally

Use [Svix Playground](https://www.svix.com/play/) or [Webhook.site](https://webhook.site/) to test.

---

## Customization

### Custom Pages

Replace default authentication pages with your own using Stack's components or low-level functions.

#### Simple Example

```tsx
// app/signin/page.tsx
import { SignIn } from "@stackframe/stack";

export default function CustomSignInPage() {
  return (
    <div>
      <h1>My Custom Sign In page</h1>
      <SignIn />
    </div>
  );
}
```

```typescript
// stack/server.ts
export const stackServerApp = new StackServerApp({
  urls: {
    signIn: "/signin",
  },
});
```

#### Building From Scratch

```tsx
"use client";
import { useStackApp } from "@stackframe/stack";

export default function CustomOAuthSignIn() {
  const app = useStackApp();
  return (
    <div>
      <h1>My Custom Sign In page</h1>
      <button onClick={async () => await app.signInWithOAuth("google")}>
        Sign In with Google
      </button>
    </div>
  );
}
```

---

### Custom Styles

Customize component colors using CSS variables:

```jsx
// app/layout.tsx
const theme = {
  light: {
    primary: "red",
  },
  dark: {
    primary: "#00FF00",
  },
  radius: "8px",
};

<StackTheme theme={theme}>
  {children}
</StackTheme>
```

#### Available Color Variables

| Variable | Description |
|----------|-------------|
| `background` | Main background color |
| `foreground` | Main text color |
| `card` | Card background color |
| `cardForeground` | Card text color |
| `popover` | Popover background |
| `popoverForeground` | Popover text color |
| `primary` | Primary brand color (buttons, important elements) |
| `primaryForeground` | Text on primary elements |
| `secondary` | Secondary color |
| `secondaryForeground` | Text on secondary elements |
| `muted` | Muted/disabled elements |
| `mutedForeground` | Text on muted elements |
| `accent` | Accent/highlight color |
| `accentForeground` | Text on accent elements |
| `destructive` | Destructive actions color |
| `destructiveForeground` | Text on destructive elements |
| `border` | Border color |
| `input` | Input border color |
| `ring` | Focus ring color |
| `radius` | Border radius |

---

### Dark Mode

Stack components support light and dark mode automatically. Use [next-themes](https://github.com/pacocoursey/next-themes):

```bash
npm install next-themes
```

```jsx
// components/providers.jsx
"use client";
import { ThemeProvider } from "next-themes";
import { StackTheme } from "@stackframe/stack";

export default function Providers({ children }) {
  return (
    <ThemeProvider defaultTheme="system" attribute="class">
      <StackTheme>{children}</StackTheme>
    </ThemeProvider>
  );
}
```

```jsx
// Color mode switcher
"use client";
import { useTheme } from "next-themes";

export default function ColorModeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
      {theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
    </button>
  );
}
```

---

### Internationalization

Pass the `lang` prop to `StackProvider`:

```jsx
<StackProvider ... lang={"de-DE"}>
  ...
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

---

## SDK Reference

### SDK Overview

The SDK provides objects, hooks, and types for the Next.js SDK:

**General:** `StackClientApp`, `StackServerApp`, `Project`

**Users & Data:** `CurrentUser`, `ServerUser`, `CurrentServerUser`, `ContactChannel`, `ServerContactChannel`

**Teams:** `Team`, `ServerTeam`, `TeamPermission`, `ServerTeamPermission`, `TeamUser`, `ServerTeamUser`, `TeamProfile`, `ServerTeamProfile`

**Email:** `SendEmailOptions`

**Payments & Items:** `Customer`, `Item`, `ServerItem`

**Hooks:** `useStackApp`, `useUser`

---

### StackClientApp

Contains methods for client-side code. Get via `useStackApp()` in Client Components.

**Constructor:**

```typescript
const stackClientApp = new StackClientApp({
  tokenStore: "nextjs-cookie",
  projectId: "123",
  publishableClientKey: "pck_123",
  urls: { home: "/" },
});
```

**Key Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `getUser([options])` | `Promise<CurrentUser \| null>` | Get current user |
| `useUser([options])` | `CurrentUser \| null` | React hook for current user |
| `getProject()` | `Promise<Project>` | Get current project |
| `useProject()` | `Project` | React hook for project |
| `signInWithOAuth(provider)` | `Promise<void>` | Start OAuth sign-in |
| `signInWithCredential(options)` | `Promise<Result>` | Email/password sign-in |
| `signUpWithCredential(options)` | `Promise<Result>` | Email/password sign-up |
| `sendForgotPasswordEmail(email)` | `Promise<Result>` | Send password reset email |
| `sendMagicLinkEmail(email)` | `Promise<Result>` | Send magic link email |

---

### StackServerApp

Extends `StackClientApp` with server-level permissions. Full read/write access.

> Requires `SECRET_SERVER_KEY`. Never expose in client code.

**Additional Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `getUser(id)` | `Promise<ServerUser \| null>` | Get any user by ID |
| `listUsers([options])` | `Promise<ServerUser[]>` | List all users |
| `createUser([options])` | `Promise<ServerUser>` | Create a new user |
| `sendEmail(options)` | `Promise<Result>` | Send emails to users |
| `getTeam(id)` | `Promise<ServerTeam \| null>` | Get team by ID |
| `listTeams()` | `Promise<ServerTeam[]>` | List all teams |
| `createTeam(options)` | `Promise<ServerTeam>` | Create a team |

**Creating Users:**

```typescript
// With password
const user = await stackServerApp.createUser({
  primaryEmail: "test@example.com",
  primaryEmailAuthEnabled: true,
  password: "password123",
});

// With magic link
const user = await stackServerApp.createUser({
  primaryEmail: "test@example.com",
  primaryEmailVerified: true,
  primaryEmailAuthEnabled: true,
  otpAuthEnabled: true,
});
```

**Listing Users with Pagination:**

```typescript
const users = await stackServerApp.listUsers({ limit: 20 });

if (users.nextCursor) {
  const nextPage = await stackServerApp.listUsers({
    cursor: users.nextCursor,
    limit: 20,
  });
}
```

---

### Hooks

#### `useStackApp()`

Returns the `StackClientApp` from the `StackProvider` context.

```jsx
import { useStackApp } from "@stackframe/stack";

function MyComponent() {
  const stackApp = useStackApp();
  return <div>Sign In URL: {stackApp.urls.signIn}</div>;
}
```

#### `useUser()`

Alias for `useStackApp().useUser()`.

```tsx
import { useUser } from "@stackframe/stack";

function MyComponent() {
  const user = useUser(); // null if not signed in
  const user = useUser({ or: "redirect" }); // redirects if not signed in
  const user = useUser({ or: "throw" }); // throws if not signed in
}
```

---

### User Types

#### `CurrentUser` (Client)

```typescript
type CurrentUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  primaryEmailVerified: boolean;
  profileImageUrl: string | null;
  signedUpAt: Date;
  hasPassword: boolean;
  clientMetadata: Json;
  clientReadOnlyMetadata: Json;
  selectedTeam: Team | null;

  update(data): Promise<void>;
  updatePassword(data): Promise<void>;
  getAuthHeaders(): Promise<Record<string, string>>;
  getAuthJson(): Promise<{ accessToken: string | null }>;
  signOut([options]): Promise<void>;
  delete(): Promise<void>;

  getTeam(id): Promise<Team | null>;
  useTeam(id): Team | null;
  listTeams(): Promise<Team[]>;
  useTeams(): Team[];
  createTeam(data): Promise<Team>;
  leaveTeam(team): Promise<void>;

  getPermission(scope, permissionId): Promise<TeamPermission | null>;
  usePermission(scope, permissionId): TeamPermission | null;
  listPermissions([scope]): Promise<TeamPermission[]>;
  usePermissions([scope]): TeamPermission[];

  getConnectedAccount(providerId, options?): Promise<ConnectedAccount | null>;
  useConnectedAccount(providerId, options?): ConnectedAccount | null;

  createApiKey(options): Promise<ApiKeyFirstView>;
  listApiKeys(): Promise<ApiKey[]>;
  useApiKeys(): ApiKey[];

  createCheckoutUrl(options): Promise<string>;
  getItem(itemId): Promise<Item>;
  useItem(itemId): Item;
};
```

#### `ServerUser` (Server)

Extends `CurrentUser` with:

```typescript
type ServerUser = CurrentUser & {
  serverMetadata: Json;
  lastActiveAt: Date;
  isPrimaryEmailVerified: boolean;

  update(data): Promise<void>; // Can update serverMetadata, clientReadOnlyMetadata
  grantPermission(scope, permissionId): Promise<void>;
  revokePermission(scope, permissionId): Promise<void>;
  createSession(): Promise<{ accessToken: string; refreshToken: string }>;
};
```

---

### Team Types

#### `Team`

```typescript
type Team = {
  id: string;
  displayName: string;
  profileImageUrl: string | null;
  clientMetadata: Json;
  clientReadOnlyMetadata: Json;

  update(data): Promise<void>;
  inviteUser(options): Promise<void>;
  listUsers(): Promise<TeamUser[]>;
  useUsers(): TeamUser[];
  listInvitations(): Promise<{ id: string; email: string; expiresAt: Date }[]>;
  useInvitations(): { id: string; email: string; expiresAt: Date }[];
  createApiKey(options): Promise<TeamApiKeyFirstView>;
  listApiKeys(): Promise<TeamApiKey[]>;
  useApiKeys(): TeamApiKey[];
  createCheckoutUrl(options): Promise<string>;
  getItem(itemId): Promise<Item>;
  useItem(itemId): Item;
};
```

#### `ServerTeam`

Extends `Team` with:

```typescript
type ServerTeam = Team & {
  createdAt: Date;
  serverMetadata: Json;

  listUsers(): Promise<ServerTeamUser[]>;
  addUser(userId): Promise<void>;
  removeUser(userId): Promise<void>;
  delete(): Promise<void>;
};
```

---

## Components Reference

| Component | Description |
|-----------|-------------|
| `<SignIn />` | Full sign-in form with OAuth, magic link, credentials |
| `<SignUp />` | Full sign-up form |
| `<CredentialSignIn />` | Email/password sign-in only |
| `<CredentialSignUp />` | Email/password sign-up only |
| `<OAuthButton />` | Single OAuth provider button |
| `<OAuthButtonGroup />` | Group of all enabled OAuth buttons |
| `<MagicLinkSignIn />` | Magic link sign-in only |
| `<ForgotPassword />` | Forgot password form |
| `<PasswordReset />` | Password reset form |
| `<UserButton />` | User avatar with dropdown menu |
| `<AccountSettings />` | Full account settings page (profile, security, API keys, 2FA) |
| `<SelectedTeamSwitcher />` | Team selector/switcher dropdown |
| `<StackHandler />` | Handles all auth routes (`/handler/*`) |
| `<StackProvider />` | Provides Stack context to child components |
| `<StackTheme />` | Provides theming context |

---

## REST API

### Authentication

**Client-Side:**

```http
curl https://api.stack-auth.com/api/v1/ \
  -H "X-Stack-Access-Type: client" \
  -H "X-Stack-Project-Id: <project-id>" \
  -H "X-Stack-Publishable-Client-Key: pck_<key>" \
  -H "X-Stack-Access-Token: <user-access-token>"
```

**Server-Side:**

```http
curl https://api.stack-auth.com/api/v1/ \
  -H "X-Stack-Access-Type: server" \
  -H "X-Stack-Project-Id: <project-id>" \
  -H "X-Stack-Secret-Server-Key: ssk_<key>"
```

### Authentication Headers

| Header | Type | Used In | Description |
|--------|------|---------|-------------|
| `X-Stack-Access-Type` | `"client"` \| `"server"` | Both | Required |
| `X-Stack-Project-Id` | UUID | Both | Required |
| `X-Stack-Publishable-Client-Key` | string | Client only | Required for client. Starts with `pck_` |
| `X-Stack-Secret-Server-Key` | string | Server only | Required for server. **Never expose in client code**. Starts with `ssk_` |
| `X-Stack-Access-Token` | string | Client only | Optional. Current user's access token |

### Error Codes

| Status | Description |
|--------|-------------|
| `400` | Invalid request parameters |
| `401` | Invalid or missing authentication |
| `403` | Insufficient permissions |
| `404` | Resource not found |
| `429` | Rate limit exceeded |
| `500` | Server error |

### Key API Endpoints

**Users:**
- `GET /api/v1/users/me` — Get current user
- `PATCH /api/v1/users/me` — Update current user
- `DELETE /api/v1/users/me` — Delete current user
- `GET /api/v1/users` — List all users (server)
- `POST /api/v1/users` — Create user (server)
- `GET /api/v1/users/:id` — Get user by ID (server)

**Authentication:**
- `POST /api/v1/auth/password/sign-in` — Email/password sign-in
- `POST /api/v1/auth/password/sign-up` — Email/password sign-up
- `POST /api/v1/auth/otp/send-sign-in-code` — Send magic link
- `POST /api/v1/auth/otp/sign-in` — Sign in with OTP code
- `POST /api/v1/auth/password/send-reset-code` — Send password reset
- `POST /api/v1/auth/password/reset` — Reset password
- `POST /api/v1/auth/anonymous/sign-up` — Anonymous sign-up

**Sessions:**
- `POST /api/v1/auth/sessions/current/refresh` — Refresh access token
- `DELETE /api/v1/auth/sessions/current` — Sign out

**Teams:**
- `GET /api/v1/teams` — List teams
- `POST /api/v1/teams` — Create team
- `GET /api/v1/teams/:id` — Get team
- `PATCH /api/v1/teams/:id` — Update team
- `DELETE /api/v1/teams/:id` — Delete team

**Contact Channels:**
- `GET /api/v1/contact-channels` — List contact channels
- `POST /api/v1/contact-channels` — Create contact channel
- `POST /api/v1/contact-channels/verify` — Verify email

**OAuth:**
- `GET /api/v1/oauth-providers` — List OAuth providers
- `POST /api/v1/auth/oauth/token` — Token exchange

---

## Integrations

### Convex

Integrate Stack Auth with Convex for real-time backend:

**1. Create Convex + Next.js app:**

```bash
npm create convex@latest  # Choose "Next.js" and "No auth"
```

**2. Install Stack Auth:**

```bash
npx @stackframe/stack-cli@latest init
```

**3. Configure Convex auth:**

```typescript
// convex/auth.config.ts
import { getConvexProvidersConfig } from "@stackframe/stack";

export default {
  providers: getConvexProvidersConfig({
    projectId: process.env.NEXT_PUBLIC_STACK_PROJECT_ID,
  }),
};
```

**4. Set auth on Convex client:**

```typescript
convexReactClient.setAuth(stackClientApp.getConvexClientAuth({}));
```

**5. Use in queries/mutations:**

```typescript
export const myQuery = query({
  handler: async (ctx) => {
    const obj = await stackServerApp.getPartialUser({ from: "convex", ctx });
    return JSON.stringify(obj);
  },
});
```

---

### Supabase

Integrate Stack Auth with Supabase Row Level Security (RLS):

**1. Create a Supabase project with RLS policies**

**2. Create a server action to mint Supabase JWTs:**

```tsx
// utils/actions.ts
"use server";
import { stackServerApp } from "@/stack/server";
import * as jose from "jose";

export const getSupabaseJwt = async () => {
  const user = await stackServerApp.getUser();
  if (!user) return null;

  return await new jose.SignJWT({
    sub: user.id,
    role: "authenticated",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET));
};
```

**3. Create Supabase client helper:**

```tsx
// utils/supabase-client.ts
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseJwt } from "./actions";

export const createSupabaseClient = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { accessToken: async () => (await getSupabaseJwt()) || "" }
  );
};
```

> Use webhooks to sync user data between Supabase and Stack Auth.

---

### CLI Authentication

Authenticate CLI applications using Stack Auth with a Python template:

```python
from stack_auth_cli_template import prompt_cli_login

refresh_token = prompt_cli_login(
    app_url="https://your-app-url.example.com",
    project_id="your-project-id",
    publishable_client_key="your-publishable-key",
)

if refresh_token is None:
    print("User cancelled login")
    exit(1)

# Use refresh token to get access token and user info
```

Download the template from [GitHub](https://github.com/stack-auth/stack-auth/tree/main/docs/public/stack-auth-cli-template.py).

---

### MCP Setup

Stack Auth provides a Model Context Protocol (MCP) server for AI-powered code assistance.

**Cursor:**

```json
{
  "mcpServers": {
    "stack-auth": {
      "url": "https://mcp.stack-auth.com/"
    }
  }
}
```

**VS Code:**

```bash
code --add-mcp '{"type":"http","name":"stack-auth","url":"https://mcp.stack-auth.com/"}'
```

**Claude Code:**

```bash
claude mcp add --transport http stack-auth https://mcp.stack-auth.com/
```

**Windsurf:**

```json
{
  "mcpServers": {
    "stack-auth": {
      "serverUrl": "https://mcp.stack-auth.com/"
    }
  }
}
```

**Claude Desktop:**

Settings → Connectors → Add Custom Connector → Name: `stack-auth`, URL: `https://mcp.stack-auth.com/`

---

## Self-Hosting

Stack Auth is fully open-source and can be self-hosted.

> **Warning**: Self-hosting requires managing updates, reliability, and security yourself.

### Architecture

| Service | Description |
|---------|-------------|
| API Backend | Core REST API (port 8102) |
| Dashboard | Management interface (port 8101) |
| Client SDK | Frontend connection library |
| PostgreSQL | User data storage (Prisma ORM) |
| Svix | Webhook delivery |
| Email Server | SMTP for emails (Inbucket for dev) |
| S3 Storage | File storage (S3Mock for dev) |

### Docker Deployment

**1. Start PostgreSQL:**

```bash
docker run -d --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 postgres
```

**2. Get the [example .env file](https://github.com/stack-auth/stack-auth/tree/main/docker/server/.env.example) and configure it** (must change `STACK_SERVER_SECRET` at minimum)

**3. Run Stack Auth:**

```bash
docker run -d --name stack-auth \
  --env-file .env \
  -p 8101:8101 \
  -p 8102:8102 \
  stackauth/server
```

Dashboard: `http://localhost:8101`, API: port 8102

**4. Configure your app:**

```env
NEXT_PUBLIC_STACK_API_URL=https://your-backend-url.com
```

### Local Development

```bash
git clone https://github.com/stack-auth/stack-auth.git
cd stack-auth
pnpm install
pnpm run dev
```

Dev launchpad: `http://localhost:8100`

| Service | Port |
|---------|------|
| Dev launchpad | 8100 |
| Dashboard | 8101 |
| API | 8102 |
| Demo | 8103 |
| Docs | 8104 |
| Inbucket (emails) | 8105 |
| Prisma Studio | 8106 |

### Post-Setup

1. Sign up on your dashboard
2. In the database, find your user and add `{ managedProjectIds: ["internal"] }` to `serverMetadata`
3. Refresh dashboard to see the "Stack Dashboard" project
4. Disable new sign-ups to the internal project
5. Create a new project for your app

---

## Additional Resources

- **Dashboard**: https://app.stack-auth.com
- **GitHub**: https://github.com/stack-auth/stack-auth
- **Discord**: https://discord.stack-auth.com
- **Documentation**: https://docs.stack-auth.com
- **Contributing**: See [CONTRIBUTING.md](https://github.com/stack-auth/stack-auth/blob/dev/CONTRIBUTING.md)
