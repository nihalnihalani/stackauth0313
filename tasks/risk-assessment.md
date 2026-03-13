# Risk Assessment: Stack Auth Integration into Nexus

> Devil's Advocate Analysis
> Date: 2026-03-13

---

## Executive Summary

Integrating Stack Auth into Nexus introduces **significant architectural tension** with the project's core identity as a privacy-first, local-only, no-backend application. While Stack Auth solves real problems (no real authentication, same-browser-only sharing), it also introduces new risks, complexity, and philosophical contradictions that must be carefully weighed. This assessment identifies 7 major risk categories and provides concrete recommendations.

---

## 1. Architectural Concerns

### 1.1 No Backend Server -- Stack Auth SDK Assumes One

**Severity: CRITICAL**

Nexus is a 100% client-side Vite + React SPA. There is no Express server, no Next.js API routes, no backend whatsoever. The Stack Auth documentation and SDK are heavily oriented toward Next.js App Router with server components.

**Specific problems:**
- `StackServerApp` requires a `STACK_SECRET_SERVER_KEY` which **must never be exposed to the client**. Nexus has no server to hold this key.
- Server-side functions like `stackServerApp.getUser()`, `stackServerApp.listUsers()`, `user.update({ serverMetadata: ... })` are all **impossible** without a backend.
- The `StackHandler` component creates server-rendered auth pages -- inapplicable in a Vite SPA.
- JWT verification (`jose.jwtVerify()`) is a server-side operation. Without a backend, tokens cannot be securely verified.

**Impact:** The entire "move API keys to `user.serverMetadata`" recommendation from NEXUS.md is impossible without a backend. The most valuable Stack Auth features (server-side user management, secure metadata, RBAC enforcement) are inaccessible.

**What actually works client-only:**
- `StackClientApp` with publishable key only
- `useUser()` hook for current user
- `<SignIn />`, `<SignUp />`, `<UserButton />` components
- `user.clientMetadata` (read/write from client -- but **user-tamperable**)
- OAuth redirect flows

### 1.2 Import Map Conflicts

**Severity: HIGH**

Nexus uses `importmap` in `index.html` to load React and dependencies from CDNs (`aistudiocdn.com`, `esm.sh`). Stack Auth's `@stackframe/stack` package will import `react` and `react-dom` via Node.js module resolution. This creates two potential React instances, which causes:
- React hooks errors ("Invalid hook call")
- Context providers not sharing state
- Hard-to-debug runtime failures

The Vite config also uses `@vitejs/plugin-react` which may conflict with how Stack Auth expects React to be bundled.

### 1.3 StackProvider Wrapping

**Severity: MEDIUM**

Stack Auth requires wrapping the app with `<StackProvider>` and `<StackTheme>`. Currently, `index.tsx` wraps with `<QueryClientProvider>`. Adding Stack Auth's providers adds:
- Another context layer
- Potential CSS conflicts between StackTheme and Tailwind CDN
- Initialization order dependencies (DB init runs before React mount -- Stack Auth may need to init before DB)

---

## 2. Security Risks

### 2.1 API Keys Remain Exposed

**Severity: HIGH**

The NEXUS.md document suggests moving API key storage to `user.serverMetadata`. This is **impossible without a backend** (see 1.1). The current reality:

- `GEMINI_API_KEY` is injected at build time via `vite.config.ts` `define` -- it is baked into the JavaScript bundle. Anyone viewing page source can extract it.
- OpenAI/Anthropic keys are entered in the Settings modal and stored in React state or localStorage.
- Stack Auth does NOT change this. Users will still enter API keys in the browser.

**Risk:** Adding Stack Auth may create a **false sense of security** -- users may believe their data is "protected" when API keys remain fully exposed in the client.

### 2.2 STACK_SECRET_SERVER_KEY Cannot Be Used

**Severity: HIGH**

The `.env.example` includes `STACK_SECRET_SERVER_KEY`. If this key is accidentally injected into the Vite bundle (via `define` or `loadEnv`), it becomes publicly visible in the built JavaScript. The current `vite.config.ts` pattern loads ALL env vars with `loadEnv(mode, '.', '')` -- the empty prefix means it loads everything, not just `VITE_` prefixed vars.

**Action required:** If Stack Auth is integrated, the Vite config MUST be audited to ensure `STACK_SECRET_SERVER_KEY` is never exposed.

### 2.3 Token Storage in SPA

**Severity: MEDIUM**

Stack Auth's SDK stores authentication tokens. In a client-only SPA:
- Tokens are stored in localStorage or cookies without `httpOnly` flag
- XSS vulnerabilities can steal tokens
- The app uses `dangerouslySetInnerHTML` in `SvgModal.tsx` for rendering AI-generated SVGs -- this is an XSS vector that could be exploited to steal Stack Auth tokens

### 2.4 The `anthropic-dangerously-allow-browser` Header

**Severity: INFORMATIONAL**

The LLM service already sets `anthropic-dangerously-allow-browser: true` for Anthropic API calls. This flag exists precisely because sending API keys from the browser is dangerous. Stack Auth doesn't address this.

---

## 3. Data Migration Risks

### 3.1 Username to User ID Migration

**Severity: CRITICAL**

Currently, ALL data is keyed by plain-text username strings:
- `chats.username = 'alice'`
- `notes.username = 'alice'`
- `syllabus.id = 'syllabus_alice'`
- `hive_transmissions.sender = 'alice'`, `recipient = 'bob'`

Stack Auth uses UUID-style user IDs (`user_123456`). Switching to Stack Auth user IDs means:

1. **All existing data becomes orphaned.** If "alice" signs in with Stack Auth, her user ID is `user_abc123`, not `alice`. All her chats, notes, and syllabus are now inaccessible.
2. **Migration is non-trivial.** How do you map `alice` -> `user_abc123`? There's no link between the old username and the new Stack Auth identity.
3. **Hive transmissions break.** The Hive system sends notes to usernames. If user IDs replace usernames, the entire UX of "type a friend's username to share" breaks -- users would need to know opaque UUIDs.
4. **Backup/restore format changes.** Exported JSON backups contain username strings. Importing old backups into the new system would fail.

### 3.2 localStorage Bloat

**Severity: LOW**

AlaSQL already uses localStorage heavily. Stack Auth will add its own localStorage entries for tokens, session state, and user data. Combined, this could approach browser localStorage limits (typically 5-10MB).

---

## 4. UX Regressions

### 4.1 Login Friction Increase

**Severity: HIGH**

Current login: Type username, press Enter. Done. No password, no email, no verification. It's instant.

With Stack Auth: Users must create an account (email + password, or OAuth), verify email, then sign in. This is a **massive friction increase** for a tool that students might want to try instantly.

For a study tool where the primary value proposition is "just start learning," requiring account creation is a significant barrier.

### 4.2 Offline Capability Broken

**Severity: HIGH**

Current state: Once CDN assets are cached, Nexus works offline (assuming Ollama for local LLM). All data is in localStorage.

With Stack Auth: Authentication requires network requests to Stack Auth servers. If the server is down or the user has no internet:
- The auth check fails
- Users cannot access their own locally-stored data
- The app becomes unusable even though all data is right there in localStorage

### 4.3 Cyberpunk Aesthetic Clash

**Severity: MEDIUM**

Nexus has a carefully crafted cyberpunk terminal aesthetic (monochrome, uppercase, tracking-widest, custom animations). Stack Auth's pre-built components (`<SignIn />`, `<UserButton />`) have their own styling. Even with `<StackTheme>` customization, achieving pixel-perfect integration with Nexus's aesthetic will require significant CSS work.

The `<UserButton />` component renders an avatar dropdown -- this doesn't match the existing `text-[10px] tracking-[0.2em] uppercase` button style throughout the app.

### 4.4 Error States

**Severity: MEDIUM**

What happens when:
- Stack Auth servers are down? Currently the app always works.
- A token expires mid-session? Does the chat stream get interrupted?
- OAuth redirect fails? The user is stuck on a blank page.
- The user clears cookies? All auth state is lost, but localStorage data remains -- orphaned.

---

## 5. Philosophical Concerns

### 5.1 Privacy-First vs. External Auth

**Severity: HIGH (Conceptual)**

Nexus's README and architecture scream "privacy-first":
- "All user data is stored locally in the browser"
- "No backend server is required"
- AlaSQL with localStorage -- deliberately local

Adding Stack Auth means:
- User identity data (email, name, OAuth tokens) is sent to Stack Auth's servers
- Stack Auth tracks login events, sessions, and user activity
- User data is no longer "just in your browser"

This is a fundamental philosophical contradiction. The project must decide: is it privacy-first-local, or is it a cloud-connected app? Trying to be both creates a confusing identity.

### 5.2 Dependency on External Service

**Severity: MEDIUM**

Stack Auth is open-source and self-hostable, which mitigates vendor lock-in. However:
- The default setup uses Stack Auth's hosted service
- Self-hosting requires running additional infrastructure (database, server)
- If Stack Auth changes pricing, APIs, or shuts down, the auth layer breaks

---

## 6. Features That Might Break

### 6.1 The Hive (Peer Sharing)

**Risk: WILL BREAK**

The Hive relies on shared localStorage between users on the same browser. This is already severely limited (same-browser-only). With Stack Auth:
- User identification changes from usernames to UUIDs
- The "type recipient username" UX needs redesign
- Cross-device sharing (the supposed benefit of Stack Auth) requires a real backend -- which doesn't exist

### 6.2 Backup/Restore

**Risk: MAY BREAK**

Backup JSON includes `username` fields. If the system switches to Stack Auth user IDs, old backups become incompatible. Migration code needed.

### 6.3 Config Persistence

**Risk: LOW**

`nexus_config` is in localStorage keyed globally (not per-user). Stack Auth multi-user on the same browser would share config. This is a pre-existing bug but becomes worse with real multi-user.

### 6.4 Session Management

**Risk: MEDIUM**

`getChatSessions(username)` uses the username string. If `username` becomes a Stack Auth user ID, the function works, but existing sessions are orphaned (see 3.1).

---

## 7. Alternative Approaches Worth Considering

### 7.1 Do Nothing (Recommended for MVP)

The current username-only system works fine for the app's use case. Students want to learn, not manage accounts. The security "improvement" is marginal given that API keys remain client-side anyway.

### 7.2 Simple Password Gate

Add an optional password to the username login. Hash it with bcrypt in the browser (via a WASM library). Store the hash in AlaSQL. This keeps everything local while adding a minimal auth layer.

**Pros:** No external dependency, no privacy concerns, stays offline-capable.
**Cons:** Not "real" auth -- passwords are in localStorage (but so is everything else).

### 7.3 Stack Auth for Identity Only (Minimal Integration)

If Stack Auth is chosen, integrate it minimally:
- Use ONLY `StackClientApp` with publishable key
- Replace LoginScreen with `<SignIn />` component
- Use `user.id` from `useUser()` as the database key
- Do NOT attempt serverMetadata, RBAC, teams, or payments
- Keep everything else identical

**Pros:** Real user identity, OAuth login, minimal code change.
**Cons:** All the philosophical and offline concerns remain. Data migration needed.

### 7.4 Stack Auth with Backend (Full Integration)

Add a lightweight Express server to unlock Stack Auth's full feature set:
- Server-side token verification
- `serverMetadata` for API key storage
- Server-mediated Hive sharing (cross-device)
- RBAC for team features

**Pros:** Unlocks the full value of Stack Auth.
**Cons:** Fundamentally changes the project architecture. No longer "no backend required." Significant development effort. Deployment complexity increases.

---

## 8. Recommendations

### DO:
1. **If integrating, use Approach 7.3 (Minimal Integration).** Client-only StackClientApp, publishable key only, useUser() for identity.
2. **Write a data migration function** that maps old username records to new Stack Auth user IDs on first login.
3. **Keep the old LoginScreen as a fallback** for offline/local-only use.
4. **Audit vite.config.ts** to ensure `STACK_SECRET_SERVER_KEY` is never bundled.
5. **Address the SvgModal XSS vector** (`dangerouslySetInnerHTML`) before adding auth tokens to the browser.
6. **Test import map compatibility** with `@stackframe/stack` before writing any integration code.

### DO NOT:
1. **Do NOT use `STACK_SECRET_SERVER_KEY` in the client.** There is no backend to hold it.
2. **Do NOT claim "API keys are now secure"** -- they are not, and won't be without a backend.
3. **Do NOT break offline capability** -- add graceful degradation for when Stack Auth servers are unreachable.
4. **Do NOT force account creation** -- consider allowing anonymous/guest usage with optional sign-up.
5. **Do NOT over-scope** -- Teams, Payments, RBAC, webhooks are all irrelevant without a backend.
6. **Do NOT delete the old auth system entirely** -- keep it as a fallback mode.

---

## Risk Summary Matrix

| Risk | Severity | Likelihood | Impact | Mitigation |
|------|----------|------------|--------|------------|
| No backend for ServerApp | CRITICAL | Certain | Blocks 60% of Stack Auth features | Use ClientApp only |
| Data migration (username->ID) | CRITICAL | Certain | All existing data orphaned | Write migration function |
| Import map conflicts | HIGH | Likely | App crashes at runtime | Test early, fix bundler config |
| API keys still exposed | HIGH | Certain | False sense of security | Document limitations clearly |
| Login friction increase | HIGH | Certain | User drop-off | Allow anonymous/guest mode |
| Offline capability broken | HIGH | Likely | App unusable without internet | Graceful degradation |
| Hive system breaks | HIGH | Certain | Core feature lost | Redesign or defer |
| Secret key exposure risk | HIGH | Possible | Full auth compromise | Audit Vite config |
| SvgModal XSS + auth tokens | MEDIUM | Possible | Token theft | Sanitize SVG input |
| CSS/styling conflicts | MEDIUM | Likely | Visual regression | Custom theme work |
| localStorage bloat | LOW | Unlikely | Data loss at limits | Monitor usage |

---

*This assessment is intended to prevent mistakes, not to block progress. If the team decides to proceed with Stack Auth, the minimal integration approach (7.3) with careful attention to the CRITICAL items above is the safest path forward.*
