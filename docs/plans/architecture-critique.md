# Architecture Critique: Stack Auth + Backend Integration for Nexus

**Reviewer:** Critic (Devil's Advocate)
**Date:** 2026-03-13
**Status:** REVIEW COMPLETE -- BLOCKING ISSUES IDENTIFIED

---

## 0. Review Scope

This critique reviews the following documents and source code:

- `docs/plans/2026-03-13-stack-auth-integration-design.md` (approved design)
- `tasks/integration-plan.md` (detailed integration plan)
- `tasks/stack-auth-knowledge.md` (SDK research)
- `tasks/risk-assessment.md` (prior risk analysis)
- All source files: `vite.config.ts`, `index.tsx`, `App.tsx`, `services/llmService.ts`, `services/dbService.ts`, `components/SvgModal.tsx`, `components/NotesModal.tsx`, `components/HiveModal.tsx`, `types.ts`, `tsconfig.json`

---

## 1. Is the Backend Framework Choice Correct?

### Assessment: INCOMPLETE -- No choice has been made yet

The design doc says "framework TBD -- architect + critic will decide between Express/Hono/etc." This is a gap. Here is my analysis for when the architect proposes one:

**Express**: The safe default. Huge ecosystem, battle-tested, universal knowledge. Downside: verbose middleware patterns, no built-in streaming support (needs manual `res.write()`), performance is mediocre compared to alternatives. For a simple proxy + auth validation server, Express is fine but uninspired.

**Hono**: Lightweight, fast, modern. Built-in SSE/streaming helpers. TypeScript-first. Runs on edge runtimes (Cloudflare Workers, Deno, Bun) which could be useful for deployment. Downside: smaller ecosystem, less community knowledge, some Stack Auth examples may not exist.

**Fastify**: Good performance, schema validation built-in, plugin architecture. Downside: more complex setup for a simple proxy, JSON schema overhead is unnecessary for this use case.

**My recommendation**: Hono or Express. For a proxy server with 5-6 routes, the framework barely matters. Pick whatever the builder is most comfortable with and move on. Do NOT spend time evaluating frameworks for a server this simple.

**Challenge**: Is a backend even necessary? See Section 8.

---

## 2. Security Holes in the Auth Flow

### 2.1 BLOCKING: `vite.config.ts` Loads ALL Env Vars

**File:** `vite.config.ts:6`
```typescript
const env = loadEnv(mode, '.', '');
```

The empty string prefix (`''`) means `loadEnv` reads ALL environment variables, not just `VITE_*` prefixed ones. Currently, lines 13-15 only expose `GEMINI_API_KEY` via `define`, but this is fragile. If anyone adds `STACK_SECRET_SERVER_KEY` to `.env` and later someone adds it to `define` (or uses `import.meta.env` which Vite auto-exposes for `VITE_*` vars), the secret key leaks into the client bundle.

**Fix required:** Change the `loadEnv` call to only load `VITE_` prefixed vars, or explicitly guard the `define` block to never include secrets. Add a CI check or startup assertion that `STACK_SECRET_SERVER_KEY` is never in the client bundle.

### 2.2 BLOCKING: SvgModal XSS Vector

**File:** `components/SvgModal.tsx:27`
```typescript
dangerouslySetInnerHTML={{ __html: content }}
```

This renders **AI-generated SVG content** directly as HTML. An LLM producing malicious SVG (with embedded `<script>` tags, `onload` handlers, or `<foreignObject>` with JavaScript) gets executed in the browser. With Stack Auth tokens stored in cookies, this becomes a **token theft vector via XSS**.

SVGs can contain:
- `<script>` tags
- `onload`, `onerror`, `onclick` event handlers on any element
- `<foreignObject>` with arbitrary HTML/JS
- CSS `url()` with `javascript:` protocol (in some browsers)

**Fix required:** Sanitize SVG content before rendering. Use DOMPurify or a similar library. Strip all `<script>`, event handlers, and `<foreignObject>` elements. This MUST be done before Stack Auth tokens are in the browser.

### 2.3 HIGH: Cookie Security Configuration

The integration plan uses `tokenStore: "cookie"`. Questions that must be answered:

1. Does Stack Auth's SDK set `httpOnly` on these cookies? If not, JavaScript (including XSS payloads via SvgModal) can read them.
2. Is `secure` flag set? Without it, cookies transmit over HTTP in development and can be intercepted on shared networks.
3. Is `sameSite` set to `Strict` or `Lax`? Without it, CSRF attacks are possible.

**The Stack Auth knowledge brief does not answer these questions.** The scout must verify the actual cookie attributes set by the SDK when using `tokenStore: "cookie"` in a non-Next.js context.

### 2.4 HIGH: API Keys in Browser Persist After Backend Proxy

The design says "No API keys in client -- all LLM calls go through backend proxy." But the current `AppConfig` type includes `apiKey: string` and `SettingsModal` lets users enter API keys. After migration:

- Are the old API key input fields removed from SettingsModal?
- Is the `apiKey` field removed from `AppConfig`?
- What about the Gemini key baked into the bundle via `process.env.API_KEY` in `vite.config.ts`?

If the SettingsModal still shows API key inputs after migration, users will be confused about whether their keys are used or the proxy's keys are used. This is a UX/security concern.

### 2.5 MEDIUM: `anthropic-dangerously-allow-browser: true`

**File:** `services/llmService.ts:93,507`

This header explicitly bypasses Anthropic's browser safety check. With a backend proxy, this header should be removed from the client. If the proxy is not implemented correctly and the client falls back to direct API calls, this header re-enables the unsafe path.

**Fix required:** After backend proxy is implemented, remove this header and ensure the client cannot make direct API calls.

---

## 3. Can API Keys Leak Through Proxy Misconfiguration?

### 3.1 BLOCKING: Proxy Must Not Forward Client Headers

If the proxy naively forwards all request headers from the client to the LLM API, a malicious client could set an `Authorization` or `x-api-key` header that gets forwarded. The proxy must:

1. Strip ALL incoming auth headers before proxying
2. Inject its own API keys from env vars
3. Never echo API keys in error responses
4. Never log API keys

### 3.2 HIGH: Error Messages Must Not Leak Keys

If the proxy catches an error from the LLM API and forwards it to the client, the error message might contain the API key (some APIs echo the key in error responses). The proxy must sanitize all error responses.

### 3.3 MEDIUM: Vite Dev Proxy Configuration

The design mentions `vite.config.ts` proxy config for development. The dev proxy config must not be used in production. Ensure the proxy config is gated behind `mode === 'development'`.

---

## 4. What Happens Offline? Does the Whole App Die?

### 4.1 BLOCKING: No Offline Graceful Degradation Strategy

The design doc mentions "Offline graceful degradation with cached auth state" as a key decision, but the integration plan has NO implementation details for this. Currently:

- All data is in localStorage (AlaSQL). Users can access their data offline.
- The only network dependency is LLM API calls (which naturally fail offline).

After Stack Auth + backend proxy:
- **Auth check requires network** (Stack Auth SDK must validate tokens with Stack Auth servers)
- **All LLM calls require network** to reach the backend proxy (previously, Ollama calls worked locally)
- If Stack Auth servers are down, `useUser()` may return `null`, showing the login screen even though the user is authenticated and their data is in localStorage

**Specific failure scenarios:**

1. **Stack Auth servers unreachable:** User sees login screen. Cannot access their own locally-stored data. This is a critical regression from the current "always works" behavior.

2. **Backend proxy down, Stack Auth up:** User is authenticated but cannot make any LLM calls. Ollama (local) calls now fail because they go through the proxy.

3. **Both down:** Complete app failure.

**Fix required:** Define explicit fallback behavior:
- Cache the last known auth state locally
- If Stack Auth is unreachable, use cached auth (with a warning banner)
- For Ollama (local LLM), allow direct calls that bypass the proxy
- Do NOT block access to locally-stored data just because auth servers are down

### 4.2 HIGH: Ollama Local Calls Now Require Network

Currently, users with Ollama running locally can use the app entirely offline. The backend proxy breaks this because even local Ollama calls would go through the proxy. The proxy server itself runs locally, but if the design expects users to self-host it, this adds deployment complexity.

**Question for architect:** Can Ollama calls bypass the proxy and go direct? If so, how do we handle auth for those requests?

---

## 5. Data Migration: Loss Scenarios

### 5.1 BLOCKING: No Rollback Strategy

The migration plan (`tasks/integration-plan.md` Section 6) describes a one-time migration from `username` to `user.id`. But:

1. **What if the migration runs and then the user wants to revert?** The old `nexus_user` localStorage key is deleted. There is no backup of the original username mapping.

2. **What if the migration runs partially?** If it updates `chats` but fails on `notes`, the user has a split-brain state.

3. **What if two different Stack Auth accounts map to the same old username?** (e.g., user previously used "john", now two different people sign up with Stack Auth and both try to claim "john"'s data)

**Fix required:**
- Take a backup of all user data before migration (export to a migration backup JSON)
- Make migration atomic (all-or-nothing within a try/catch)
- Store the old username -> new user.id mapping in a migration_log table so it can be reversed
- On first migration attempt, set a flag. If the flag is already set, don't re-run.

### 5.2 HIGH: Syllabus ID Construction is Fragile

**File:** `services/dbService.ts:224`
```typescript
const id = `syllabus_${username}`;
```

If `username` changes from `"alice"` to `"usr_abc123"`, the syllabus ID changes from `"syllabus_alice"` to `"syllabus_usr_abc123"`. The migration must update the `id` column in the syllabus table, not just the `username` column.

The migration plan in `tasks/integration-plan.md` does:
```typescript
alasql('UPDATE syllabus SET username = ? WHERE username = ?', [newUserId, oldUsername]);
```

But does NOT update the `id` column:
```typescript
// MISSING: alasql('UPDATE syllabus SET id = ? WHERE id = ?', [`syllabus_${newUserId}`, `syllabus_${oldUsername}`]);
```

This means `getSyllabus(newUserId)` will look for `syllabus_usr_abc123` but the record has `id = syllabus_alice`. **The syllabus will appear lost after migration.**

### 5.3 MEDIUM: Hive Transmissions Reference Old Usernames

If Alice sends a note to Bob before migration, the transmission has `sender = "alice"` and `recipient = "bob"`. After migration, Bob's username is now `"usr_xyz789"`. The `getHiveTransmissions("usr_xyz789")` query finds nothing because the record still has `recipient = "bob"`.

The migration must also update the `recipient` column for pending transmissions. But what about `sender`? Displaying `sender = "usr_abc123"` instead of "alice" is terrible UX.

---

## 6. Hive Feature Compatibility with Real Auth

### 6.1 HIGH: Hive Is Fundamentally Broken with Stack Auth

The Hive feature currently works because:
- All users share the same browser's localStorage
- AlaSQL operates on a single shared database
- `sendHiveNote` writes to the same DB that `getHiveTransmissions` reads from

With Stack Auth:
- Different users log into different accounts, but still share the same localStorage
- This actually still works in the same browser (User A logs out, User B logs in, User B sees transmissions)
- But it does NOT work cross-device, which is presumably the point of adding real auth

**The Hive feature was designed for same-browser sharing. Real auth does not help it. It needs a backend to work cross-device. Without a backend, it's exactly the same as before but with UUID-based usernames instead of display names.**

The integration plan (Section 4.8) acknowledges this: "Since this is a local-only feature using AlaSQL (in-browser), it only works between browser tabs of the same user anyway."

**Recommendation:** Either:
1. Add a Hive endpoint to the backend proxy (POST/GET `/api/hive`) for cross-device sharing, or
2. Explicitly document that Hive remains same-browser-only and the UX of "type a friend's UUID" is terrible, or
3. Defer Hive to a future release and disable it during Stack Auth migration

### 6.2 MEDIUM: Hive Recipient UX Regression

Currently, users type a human-readable username ("alice"). After migration, they would need to type a Stack Auth UUID ("usr_abc123"). This is a severe UX regression. The NotesModal transmit form has a simple text input with `placeholder="RECIPIENT_ID"`.

**Fix required:** Use `displayName` for the transmit recipient lookup, or add a user search/lookup endpoint to the backend.

---

## 7. Proxy Latency Impact on LLM Streaming

### 7.1 MEDIUM: Added Latency is Likely Acceptable

Adding a proxy between the client and LLM APIs adds:
- ~1-5ms per request (local proxy, same machine)
- One additional TCP connection per stream

For LLM streaming responses that take 2-30 seconds, this overhead is negligible. The proxy does NOT buffer the response (it should use `res.write()` to forward chunks immediately).

**Potential issue:** If the proxy implementation incorrectly buffers the entire response before forwarding (e.g., using `await response.json()` instead of streaming), the user will see no output for seconds, then everything at once. This is a common mistake.

**Requirement for builder:** The proxy MUST stream responses chunk-by-chunk. Use `ReadableStream` piping or manual chunk forwarding. Test by verifying the first chunk arrives within 100ms of the LLM API starting to stream.

### 7.2 LOW: CORS Preflight Requests

If the frontend and backend are on different origins (even different ports on localhost), every LLM request will trigger a CORS preflight `OPTIONS` request. This adds ~10-50ms per request. Use the Vite dev proxy to avoid CORS in development, and same-origin deployment in production.

---

## 8. Is a Backend Even Necessary?

### 8.1 The Case AGAINST a Backend

The existing risk assessment (`tasks/risk-assessment.md`, Section 7.1-7.3) already makes this argument well. Let me steel-man it:

1. **API key security**: The primary argument for a backend is "move API keys server-side." But the Google Gemini key is already baked into the build via `vite.config.ts`. Users can extract it from the JS bundle regardless. For other providers, users enter their own keys in Settings. Moving those to a server is only valuable if the server provides shared keys (SaaS model) -- which is not the stated goal.

2. **Auth validation**: `StackClientApp` provides client-side auth. For a local-first app where all data is in localStorage, server-side auth validation adds no real security. The data is already accessible by anyone with physical access to the browser.

3. **Deployment complexity**: Adding a backend means users must run two processes (Vite dev server + backend), configure CORS, manage two sets of env vars, and deploy two services. For a learning/study tool, this is significant friction.

4. **The "Approach 7.3" alternative**: The risk assessment recommends minimal client-only integration. This is simpler, faster to implement, and avoids all the backend-related risks identified in this critique.

### 8.2 The Case FOR a Backend

1. **LLM API key proxying for shared deployments**: If Nexus is deployed as a hosted service (not self-hosted), users should not need to bring their own API keys. A backend with server-managed keys enables this.

2. **Cross-device Hive**: The Hive feature is essentially useless without a backend. Real peer-to-peer sharing requires server mediation.

3. **Future features**: Teams, permissions, shared workspaces all require a backend.

4. **Stack Auth server-side features**: `StackServerApp` enables server metadata, user management, admin APIs, and JWT verification. Without a backend, 60% of Stack Auth's value is inaccessible.

### 8.3 My Verdict

**The backend IS justified IF the goal is a hosted/shared deployment.** If the goal is just "add login to a local-only app," a backend is over-engineering.

The design doc says "Backend handles auth + API key proxy (not full DB migration)" and "AlaSQL stays as local storage (no server-side DB)." This is a reasonable middle ground. But the team must be honest about the tradeoff: this is no longer a "no backend required" app.

**BLOCKING QUESTION for team lead:** Is the goal (a) a hosted service with shared API keys, or (b) a local-first app with optional login? The answer determines whether a backend is necessary.

---

## 9. CDN Dependencies vs npm Stack Auth SDK

### 9.1 HIGH: React CDN Import Map May Conflict with Bundled Stack Auth

The current `index.html` (not viewed but referenced in docs) uses import maps to load React from CDNs. The `@stackframe/stack` npm package imports `react` and `react-dom` via Node.js module resolution. Vite bundles npm dependencies, but the CDN-loaded React is a separate instance.

This creates the classic **dual React instance problem**:
- Stack Auth components use the bundled React (from node_modules)
- App components use the CDN React (from import map)
- React contexts don't cross instance boundaries
- `StackProvider` context is invisible to `useUser()` in app components
- Result: hooks crash with "Invalid hook call"

**The integration plan does not address this.** The risk assessment (Section 1.2) correctly flags it as HIGH severity.

**Fix required:** Either:
1. Remove the CDN import map and use Vite-bundled React for everything (recommended), or
2. Configure Vite to externalize React and use the CDN version (complex, fragile), or
3. Verify that the import map does NOT conflict with Vite's bundling (test early)

This must be resolved BEFORE any Stack Auth code is written.

---

## 10. Cookie Security in SPA Architecture

### 10.1 HIGH: `tokenStore: "cookie"` Assumptions

The knowledge brief states: "For a client-only React app, 'cookie' is the recommended store."

Questions:
1. **Are these `httpOnly` cookies?** If not, any XSS (including the SvgModal vector) can steal them via `document.cookie`.
2. **Does the SDK use `secure` flag in production?** Without it, cookies transmit over HTTP.
3. **Does `sameSite` prevent CSRF?** In an SPA with no backend, CSRF is less of a concern, but with a backend proxy, CSRF on the proxy endpoints becomes relevant.
4. **What is the token lifetime?** The knowledge brief says "10-minute JWT lifetime, auto-refreshed." What happens if the refresh token expires while the user is offline?

**The scout must answer these questions with references to Stack Auth documentation or SDK source code.** Do not assume the SDK "handles it" -- verify the actual cookie attributes.

### 10.2 MEDIUM: Cookie Size Limits

Cookies have a 4KB size limit per cookie. Stack Auth tokens (JWTs with user data) can approach this limit, especially with custom claims or metadata. If the token exceeds 4KB, the cookie silently fails in some browsers.

---

## BLOCKING ISSUES SUMMARY

| # | Issue | Severity | Section |
|---|-------|----------|---------|
| B1 | `vite.config.ts` loads ALL env vars -- secret key exposure risk | BLOCKING | 2.1 |
| B2 | SvgModal XSS via `dangerouslySetInnerHTML` -- token theft vector | BLOCKING | 2.2 |
| B3 | No offline graceful degradation implementation | BLOCKING | 4.1 |
| B4 | No migration rollback strategy -- potential data loss | BLOCKING | 5.1 |
| B5 | Syllabus ID not updated during migration -- data appears lost | BLOCKING | 5.2 |
| B6 | React CDN import map vs npm Stack Auth -- potential dual instance crash | BLOCKING | 9.1 |
| B7 | Proxy must strip incoming auth headers -- API key leak vector | BLOCKING | 3.1 |
| B8 | Team must decide: hosted service vs local-first app | BLOCKING | 8.3 |

## HIGH-PRIORITY ISSUES

| # | Issue | Severity | Section |
|---|-------|----------|---------|
| H1 | Cookie security attributes unknown (httpOnly, secure, sameSite) | HIGH | 2.3, 10.1 |
| H2 | API key input UI confusion after proxy migration | HIGH | 2.4 |
| H3 | Ollama local calls broken by proxy requirement | HIGH | 4.2 |
| H4 | Hive feature fundamentally broken with real auth | HIGH | 6.1 |
| H5 | Hive recipient UX regression (UUID vs display name) | HIGH | 6.2 |
| H6 | Error messages must not leak API keys | HIGH | 3.2 |

## RECOMMENDATIONS

1. **Fix SvgModal XSS BEFORE adding auth tokens.** This is a pre-existing vulnerability that becomes critical with auth.
2. **Resolve the React CDN vs npm question FIRST.** If this doesn't work, nothing else matters.
3. **Fix `vite.config.ts` env loading immediately.** Change to load only `VITE_*` vars.
4. **Decide the deployment model** (hosted vs local-first) before building the backend.
5. **Add migration rollback** and fix the syllabus ID bug.
6. **Verify Stack Auth cookie security attributes** in a non-Next.js context.
7. **Design offline fallback** with cached auth state.
8. **Make proxy streaming a hard requirement** with a test for time-to-first-chunk.

---

*This critique is intended to strengthen the implementation. Every blocking issue must be resolved or explicitly accepted (with documented risk) before the builder starts work.*

---

## ADDENDUM: Post-Architecture Review (Updated After Tasks #1 and #2 Completed)

After reviewing `docs/plans/backend-architecture.md`, `docs/stack-auth-research.md`, and `docs/plans/proxy-api-surface.md`, here is the updated status of each blocking issue:

### Framework Choice: Express -- ACCEPTABLE

The architect chose Express v5. Justification is solid (Section 1 of backend-architecture.md). For a 6-route proxy server, this is fine. The streaming pattern using `res.write()` + `res.flushHeaders()` is correct. No objection.

### Updated Blocking Issue Status

| # | Issue | Original | Updated | Notes |
|---|-------|----------|---------|-------|
| B1 | `vite.config.ts` env loading | BLOCKING | RESOLVED | Architect explicitly removes `process.env.API_KEY` define and calls out the `loadEnv` fix in Section 7, Rule 4. Builder must implement this. |
| B2 | SvgModal XSS | BLOCKING | STILL BLOCKING | Not addressed anywhere in architect's docs. Must be fixed before auth tokens are in the browser. |
| B3 | No offline degradation | BLOCKING | DOWNGRADED to HIGH | Architect acknowledges in Section 13.5 but defers: "For MVP, show an error." Acceptable for MVP, but must be tracked for v2. |
| B4 | No migration rollback | BLOCKING | STILL BLOCKING | Architect's migration (Section 6) wraps in try/catch but does NOT backup data first. Add `exportBackup()` call before migration. |
| B5 | Syllabus ID not updated | BLOCKING | RESOLVED | Architect's migration SQL (Section 6) explicitly updates syllabus `id` column. Well done. |
| B6 | React CDN dual instance | BLOCKING | STILL BLOCKING | Not addressed in any document. This is a showstopper that must be tested before any Stack Auth code is written. |
| B7 | Proxy header stripping | BLOCKING | DOWNGRADED to HIGH | Architect's code constructs fresh upstream requests with server-side API keys (Section 9). Client headers are NOT forwarded to LLM APIs. Implicit fix, but builder should add explicit check that no client `Authorization`/`x-api-key` headers reach upstream. |
| B8 | Deployment model decision | BLOCKING | STILL OPEN | Architecture assumes backend exists and proceeds. The "why" is not stated. Acceptable to proceed with backend, but document the assumption. |

### New Issues Found in Architecture

**NEW-1 (MEDIUM): Auth header inconsistency between proxy-api-surface.md and backend-architecture.md**

`proxy-api-surface.md` says auth token goes in `Authorization: Bearer <token>` header, but `backend-architecture.md` Section 4 (middleware) reads from `x-stack-access-token` header. The scout's research (Section 3) also uses `x-stack-access-token`. The builder must use ONE header consistently. Recommend `x-stack-access-token` since that aligns with Stack Auth conventions and avoids collision with the `Authorization` header the proxy uses for upstream API calls.

**NEW-2 (MEDIUM): 10MB body limit may be too small for multi-image chat**

`backend-architecture.md` Section 8 sets `express.json({ limit: '10mb' })`. But the chat stream endpoint accepts a `history` array where each message can have base64 image attachments. A conversation with 5 images at 2MB each = 10MB just for history. Consider 20MB or use streaming upload for document processing.

**NEW-3 (LOW): `express-rate-limit` is per-IP, not per-user**

Section 11 suggests rate limiting by IP. Behind a reverse proxy (Cloudflare, nginx), all clients may share the same IP. Rate limiting should be per user ID from the JWT, not per IP.

### Revised Summary: 3 Remaining Blockers

1. **B2: SvgModal XSS** -- Must sanitize SVG before rendering. Install DOMPurify.
2. **B4: Migration rollback** -- Add backup before migration.
3. **B6: React CDN dual instance** -- Test and resolve before Stack Auth integration.

These three must be fixed. Everything else is tracked as HIGH/MEDIUM and acceptable for MVP with documented risk.
