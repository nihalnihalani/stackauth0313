# Backend Architecture for Nexus Stack Auth + LLM API Proxy

**Date:** 2026-03-13
**Author:** architect
**Status:** Proposed (pending team lead approval)

---

## 1. Framework Choice: Express.js

### Decision
Use **Express.js** (`express` v5) as the backend framework.

### Justification

| Criterion | Express | Hono | Fastify |
|-----------|---------|------|---------|
| Ecosystem maturity | Excellent -- 10+ years, massive middleware ecosystem | Good but newer | Good |
| SSE/streaming support | Native via `res.write()` + `res.flush()` | Native | Native via reply.raw |
| TypeScript support | Good with `@types/express` | Excellent (built-in) | Excellent |
| Team familiarity | Most likely known -- de facto Node.js standard | Less common | Less common |
| Stack Auth examples | Official docs use Express-style `fetch` patterns | No official examples | No official examples |
| Bundle size | Larger (~2MB node_modules) | Tiny (~100KB) | Medium (~500KB) |
| Learning curve | Lowest | Low | Medium |

**Why not Hono?** Hono is excellent for edge/serverless, but Nexus runs as a local dev server alongside Vite. Express's streaming support via `res.write()` is battle-tested for SSE, and the middleware pattern maps cleanly to our auth validation needs.

**Why not Fastify?** Fastify's schema-based validation is overkill for our simple proxy routes. Express is simpler for a lightweight proxy server with ~6 routes.

### Dependencies to Install
```bash
npm install express cors jose dotenv
npm install -D @types/express @types/cors tsx
```

- `express` -- HTTP server
- `cors` -- Cross-origin support (production)
- `jose` -- JWT verification for Stack Auth tokens (recommended by Stack Auth docs)
- `dotenv` -- Load .env for server process
- `tsx` -- TypeScript execution for dev (replaces ts-node, faster)

---

## 2. Server Directory Structure

```
server/
  index.ts              # Server entry point, Express app setup, starts listening
  middleware/
    auth.ts             # Stack Auth JWT verification middleware
  routes/
    health.ts           # GET /api/health
    chat.ts             # POST /api/chat/stream (main streaming LLM proxy)
    generate.ts         # POST /api/generate-title, POST /api/generate-syllabus, POST /api/generate-assessment
  services/
    llm/
      index.ts          # Provider router (dispatches to correct provider)
      google.ts         # Google Gemini API calls
      openai.ts         # OpenAI API calls
      anthropic.ts      # Anthropic API calls
      ollama.ts         # Ollama local API calls
  config.ts             # Server configuration (env vars, constants)
  types.ts              # Server-side TypeScript types
```

### Why This Structure?

- **middleware/auth.ts** -- Single file because we have exactly one middleware (auth). No over-abstraction.
- **routes/** -- One file per logical route group. `chat.ts` handles the main streaming endpoint. `generate.ts` groups the three non-streaming generation endpoints (title, syllabus, assessment) since they share the same pattern.
- **services/llm/** -- Extracts the LLM provider logic from the current monolithic `llmService.ts` (534 lines). Each provider gets its own file. The `index.ts` routes to the correct one based on the `provider` field.
- **config.ts** -- Single source of truth for all env vars and defaults.

---

## 3. API Route Definitions

### 3.1 Health Check

```
GET /api/health
```

**Auth:** None
**Response:** `200 { "status": "ok", "timestamp": <number> }`
**Purpose:** Load balancer / dev tooling health check.

---

### 3.2 Chat Stream (Main LLM Proxy)

```
POST /api/chat/stream
```

**Auth:** Required (Stack Auth JWT in `x-stack-access-token` header)
**Content-Type:** `application/json`

**Request Body:**
```typescript
{
  provider: "google" | "openai" | "anthropic" | "ollama";
  model: string;
  mode: "direct" | "socratic";
  systemInstruction?: string;
  history: Array<{
    id: string;
    role: "user" | "model" | "system";
    text: string;
    attachments?: Array<{
      type: "image" | "file";
      mimeType: string;
      data: string; // base64
      name?: string;
    }>;
  }>;
  prompt: string;
}
```

**Response:** `200` with `Content-Type: text/event-stream`
**SSE Format:**
```
data: {"text": "chunk of response text"}
data: {"text": "next chunk"}
data: [DONE]
```

**Error Responses:**
- `401` -- Missing or invalid auth token
- `400` -- Invalid request body (missing provider, prompt, etc.)
- `502` -- Upstream LLM API error (pass through error message)

**Implementation Notes:**
- Server reads the appropriate API key from env vars based on `provider`
- For Ollama, the server proxies to the configured `OLLAMA_BASE_URL` (default `http://localhost:11434`)
- For OpenAI-compatible providers, the server uses `OPENAI_BASE_URL` env var
- Streaming: Server makes the upstream call, reads the stream, and re-emits as normalized SSE to the client
- AbortController: If the client disconnects (req `close` event), abort the upstream request

---

### 3.3 Generate Title

```
POST /api/generate-title
```

**Auth:** Required
**Request Body:**
```typescript
{
  provider: "google" | "openai" | "anthropic" | "ollama";
  model?: string;  // optional, server uses fast model default
  content: string; // first 500 chars of the conversation
}
```

**Response:** `200 { "title": "Generated Title" }`
**Notes:** Non-streaming. Uses fast/cheap model variant. Server-side the prompt is hardcoded (same as current `generateTitle` in llmService.ts).

---

### 3.4 Generate Syllabus

```
POST /api/generate-syllabus
```

**Auth:** Required
**Content-Type:** `application/json`

**Request Body:**
```typescript
{
  provider: "google" | "openai" | "anthropic" | "ollama";
  model?: string;
  notes: Array<{ title: string; content: string }>; // note excerpts
  currentSyllabusJson?: string; // existing syllabus for incremental update
}
```

**Response:** `200` with `Content-Type: text/event-stream` (streamed JSON)
**Notes:** Streaming because syllabus generation can be slow with many notes. The prompt construction logic moves server-side (currently in `generateSyllabus` in llmService.ts).

---

### 3.5 Generate Assessment

```
POST /api/generate-assessment
```

**Auth:** Required
**Content-Type:** `application/json`

**Request Body:**
```typescript
{
  provider: "google" | "openai" | "anthropic" | "ollama";
  model?: string;
  topic: string;
  notes: Array<{ title: string; content: string }>; // relevant notes
}
```

**Response:** `200` with `Content-Type: text/event-stream` (streamed JSON array of quiz questions)
**Notes:** Streaming. Server handles note filtering and prompt construction (currently in `generateAssessment` in llmService.ts).

---

### 3.6 Process Document (File/Image Extraction)

```
POST /api/process-document
```

**Auth:** Required
**Content-Type:** `application/json`

**Request Body:**
```typescript
{
  provider: "google" | "openai" | "anthropic";
  model?: string;
  attachment: {
    type: "image" | "file";
    mimeType: string;
    data: string; // base64
    name?: string;
  };
}
```

**Response:** `200 { "title": "Extracted Title", "content": "# Extracted Content..." }`
**Notes:** Non-streaming. Moves the `processDocument` logic server-side. Large base64 payloads -- consider a 10MB request size limit.

---

## 4. Stack Auth Token Validation Middleware

### Architecture

Based on [Stack Auth Backend Integration docs](https://stack-auth.com/docs/concepts/backend-integration), we use **JWT verification** (not REST API verification) for performance. JWT verification is local, requires no network call to Stack Auth on every request, and provides the user ID we need.

### middleware/auth.ts Design

```typescript
// Stack Auth JWT verification middleware
// Reference: https://stack-auth.com/docs/concepts/backend-integration
// Reference: https://stack-auth.com/docs/concepts/jwt

import * as jose from 'jose';
import { Request, Response, NextFunction } from 'express';

// Cache JWKS -- refreshed automatically by jose library
const jwks = jose.createRemoteJWKSet(
  new URL(`https://api.stack-auth.com/api/v1/projects/${process.env.STACK_PROJECT_ID}/.well-known/jwks.json`)
);

export interface AuthenticatedRequest extends Request {
  userId: string;       // Stack Auth user ID (from JWT `sub` claim)
  userEmail?: string;   // From JWT `email` claim
  userName?: string;    // From JWT `name` claim
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const accessToken = req.headers['x-stack-access-token'] as string;

  if (!accessToken) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  try {
    const { payload } = await jose.jwtVerify(accessToken, jwks, {
      audience: process.env.STACK_PROJECT_ID,
    });

    // Reject anonymous and restricted users
    if (payload.is_anonymous) {
      return res.status(403).json({ error: 'Anonymous users cannot access this endpoint' });
    }
    if (payload.is_restricted) {
      return res.status(403).json({ error: 'Restricted users cannot access this endpoint' });
    }

    // Attach user info to request
    (req as AuthenticatedRequest).userId = payload.sub as string;
    (req as AuthenticatedRequest).userEmail = payload.email as string | undefined;
    (req as AuthenticatedRequest).userName = payload.name as string | undefined;

    next();
  } catch (error) {
    console.error('JWT verification failed:', error);
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }
}
```

### Key Design Decisions

1. **JWT over REST API verification**: JWT verification is ~0ms (local crypto check) vs ~50-200ms (network round-trip to Stack Auth servers). For a streaming proxy that handles every LLM request, latency matters.

2. **JWKS caching**: The `jose` library's `createRemoteJWKSet` automatically caches keys and refreshes them when a key rotation is detected (via `kid` mismatch). No manual cache invalidation needed.

3. **Audience validation**: We validate `aud` matches our project ID, preventing tokens from other Stack Auth projects from being accepted.

4. **Anonymous/restricted rejection**: The middleware rejects anonymous sessions (`is_anonymous: true`) and restricted users (`is_restricted: true`). Only fully authenticated, non-restricted users can use the LLM proxy.

5. **No `STACK_SECRET_SERVER_KEY` needed for JWT path**: JWT verification uses public keys from the JWKS endpoint. The secret server key is only needed for REST API verification or server-side user management operations.

### Fallback: REST API Verification

If we later need full user profile data (serverMetadata, permissions, etc.), we can add a separate middleware that uses the REST API approach:

```typescript
// Only use this when full user profile is needed (e.g., checking serverMetadata)
async function requireAuthWithProfile(req, res, next) {
  const accessToken = req.headers['x-stack-access-token'];
  const response = await fetch('https://api.stack-auth.com/api/v1/users/me', {
    headers: {
      'x-stack-access-type': 'server',
      'x-stack-project-id': process.env.STACK_PROJECT_ID,
      'x-stack-secret-server-key': process.env.STACK_SECRET_SERVER_KEY,
      'x-stack-access-token': accessToken,
    },
  });
  // ... handle response
}
```

This is NOT used by default -- only if we add features requiring server metadata.

---

## 5. Vite Dev Proxy Configuration

### Design

In development, the Vite dev server (port 3000) proxies `/api/*` requests to the Express backend server (port 3001). This avoids CORS issues and gives the frontend a single origin.

### Updated vite.config.ts

```typescript
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          // Enable WebSocket proxy if we add WS support later
          ws: true,
        },
      },
    },
    plugins: [react()],
    define: {
      // Remove process.env.API_KEY -- no longer needed client-side
      // Google API key is now server-side only
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
```

### Key Changes
1. **Add proxy rule**: `/api` -> `http://localhost:3001`
2. **Remove `process.env.API_KEY` define**: The Gemini API key is no longer injected into the client bundle. It lives server-side only.
3. **Keep port 3000**: Frontend URL doesn't change for developers.

### Production
In production, either:
- **Option A (Recommended)**: Deploy backend separately (e.g., Railway, Fly.io) and set `VITE_API_BASE_URL` env var in the frontend build to point to the backend URL.
- **Option B**: Have the Express server also serve the built Vite static files (add `express.static('dist')` in production mode).

---

## 6. Data Migration Strategy (username -> user.id)

### The Problem
All existing data in AlaSQL localStorage is keyed by plain-text username strings:
- `chats.username = 'alice'`
- `notes.username = 'alice'`
- `syllabus.id = 'syllabus_alice'`
- `hive_transmissions.sender = 'alice'`

After Stack Auth integration, the user identifier becomes a UUID like `user_abc123`. Existing data becomes orphaned.

### Design: Client-Side Migration Utility

The migration runs **entirely client-side** (in the browser) because all data lives in AlaSQL/localStorage. The backend is not involved.

#### Migration Flow

```
1. User logs in with Stack Auth -> useUser() returns user object
2. App.tsx useEffect checks localStorage for old 'nexus_user' key
3. If old username exists AND old username != user.id:
   a. Query AlaSQL for data counts under old username
   b. If data exists -> show MigrationPrompt modal
   c. User accepts -> executeMigration(oldUsername, user.id)
   d. User declines -> skip, remove nexus_user key
4. Remove 'nexus_user' from localStorage
5. Continue to app with user.id as the data key
```

#### Migration SQL Operations

```typescript
function executeMigration(oldUsername: string, newUserId: string): void {
  // Update all tables that use username as a key
  alasql('UPDATE chats SET username = ? WHERE username = ?', [newUserId, oldUsername]);
  alasql('UPDATE notes SET username = ? WHERE username = ?', [newUserId, oldUsername]);
  alasql('UPDATE syllabus SET username = ? WHERE username = ?', [newUserId, oldUsername]);
  alasql('UPDATE users SET username = ? WHERE username = ?', [newUserId, oldUsername]);

  // Syllabus has a composite ID: syllabus_{username}
  const oldSyllabusId = `syllabus_${oldUsername}`;
  const newSyllabusId = `syllabus_${newUserId}`;
  alasql('UPDATE syllabus SET id = ? WHERE id = ?', [newSyllabusId, oldSyllabusId]);

  // Hive transmissions: update sender field (recipient stays as-is)
  alasql('UPDATE hive_transmissions SET sender = ? WHERE sender = ?', [newUserId, oldUsername]);

  // Clean up localStorage
  localStorage.removeItem('nexus_user');
}
```

#### Edge Cases
- **No old data**: Skip migration silently, just remove `nexus_user` key.
- **Multiple old usernames**: Not possible -- `nexus_user` stores a single username. Only one migration per browser.
- **Migration fails**: Wrap in try/catch, show error, let user retry or skip.
- **User clears cookies but not localStorage**: Data is still under the old username. Next Stack Auth login will offer migration again (if `nexus_user` key still exists, unlikely after being removed).

#### Hive Transmission Recipient Issue
The Hive system sends notes to a recipient by username string. After migration:
- Sender field gets updated to user.id
- Recipient field remains as the old username string (we can't know the recipient's new user.id)
- **Recommendation**: The Hive feature is inherently limited (same-browser-only via shared localStorage). Accept that cross-user Hive sharing will use whatever identifier the sender types. In the future, if we add a real backend for Hive, implement a username lookup endpoint.

---

## 7. Environment Variables

### Server-Side (.env)

```bash
# Stack Auth (required)
STACK_PROJECT_ID=<your-project-id>
STACK_SECRET_SERVER_KEY=ssk_<your-secret-server-key>

# LLM API Keys (at least one required)
GEMINI_API_KEY=<google-gemini-api-key>
OPENAI_API_KEY=<openai-api-key>
ANTHROPIC_API_KEY=<anthropic-api-key>

# Ollama (optional, defaults shown)
OLLAMA_BASE_URL=http://localhost:11434

# OpenAI-compatible base URL (optional, for OpenRouter, local models, etc.)
OPENAI_BASE_URL=https://api.openai.com/v1

# Server config
PORT=3001
NODE_ENV=development
```

### Client-Side (VITE_ prefixed, safe to expose)

```bash
# Stack Auth client (required)
VITE_STACK_PROJECT_ID=<your-project-id>
VITE_STACK_PUBLISHABLE_CLIENT_KEY=pck_<your-publishable-client-key>

# API base URL (production only, dev uses Vite proxy)
VITE_API_BASE_URL=                # empty in dev, set to backend URL in production
```

### Security Rules
1. **NEVER** prefix server secrets with `VITE_` -- Vite bundles all `VITE_*` vars into the client JS.
2. **Remove** the current `process.env.API_KEY` define from vite.config.ts -- no API keys in the client bundle.
3. The `STACK_SECRET_SERVER_KEY` is only needed if using REST API verification (not JWT). Include it for future flexibility but it stays server-side only.
4. The current `loadEnv(mode, '.', '')` in vite.config.ts loads ALL env vars with empty prefix. This must be changed to only load `VITE_` prefixed vars to prevent accidental exposure.

---

## 8. Server Entry Point Design

### server/index.ts

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { healthRouter } from './routes/health';
import { chatRouter } from './routes/chat';
import { generateRouter } from './routes/generate';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGIN
    : 'http://localhost:3000',
  credentials: true,
}));

// Body parsing -- 10MB limit for document processing (base64 images/PDFs)
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api', healthRouter);
app.use('/api', chatRouter);
app.use('/api', generateRouter);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Nexus backend running on port ${PORT}`);
});
```

### NPM Scripts

Add to `package.json`:
```json
{
  "scripts": {
    "dev": "vite",
    "dev:server": "tsx watch server/index.ts",
    "dev:all": "concurrently \"npm run dev\" \"npm run dev:server\"",
    "build": "vite build",
    "build:server": "tsc -p server/tsconfig.json",
    "start:server": "node dist-server/index.js"
  }
}
```

Additional dev dependency: `concurrently` for running both servers.

### Server TypeScript Config

Create `server/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "outDir": "../dist-server",
    "rootDir": ".",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["./**/*.ts"]
}
```

---

## 9. LLM Provider Service Design

### Architecture

The server-side LLM service replaces the client-side `services/llmService.ts`. Each provider gets its own module, and a router dispatches based on the `provider` field.

### Provider Router (server/services/llm/index.ts)

```typescript
export async function streamLLMResponse(params: {
  provider: string;
  model: string;
  mode: string;
  systemInstruction?: string;
  history: Message[];
  prompt: string;
  onChunk: (text: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  switch (params.provider) {
    case 'google':   return streamGoogle(params);
    case 'openai':   return streamOpenAI(params);
    case 'anthropic': return streamAnthropic(params);
    case 'ollama':   return streamOllama(params);
    default:         throw new Error(`Unknown provider: ${params.provider}`);
  }
}
```

### Key Differences from Client-Side

1. **API keys come from env vars**, not from request body. The client never sends API keys.
2. **No `anthropic-dangerously-allow-browser` header** -- server-side calls don't need it.
3. **Google Gemini**: Uses `process.env.GEMINI_API_KEY` instead of `process.env.API_KEY` (the Vite-injected one).
4. **AbortController**: Tied to Express request lifecycle -- when client disconnects, abort upstream.

### SSE Streaming Pattern (routes/chat.ts)

```typescript
router.post('/chat/stream', requireAuth, async (req, res) => {
  const { provider, model, mode, systemInstruction, history, prompt } = req.body;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    await streamLLMResponse({
      provider,
      model,
      mode,
      systemInstruction,
      history,
      prompt,
      onChunk: (text) => {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      },
      signal: controller.signal,
    });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    if (!controller.signal.aborted) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});
```

---

## 10. Frontend Client Changes (Summary for Builder)

The frontend `services/llmService.ts` needs to be rewritten to call the backend proxy instead of making direct API calls. Key changes:

### New Client LLM Service Pattern

```typescript
// services/llmService.ts (new version -- client-side)

export const streamResponse = async (
  user: CurrentUser,  // Stack Auth user object
  config: { provider: string; model: string; mode: string },
  history: Message[],
  prompt: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal
) => {
  const { accessToken } = await user.getAuthJson();

  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-stack-access-token': accessToken,
    },
    body: JSON.stringify({
      provider: config.provider,
      model: config.model,
      mode: config.mode,
      history,
      prompt,
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Server error: ${err}`);
  }

  // Read SSE stream
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) throw new Error('No response body');

  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.text) onChunk(parsed.text);
          if (parsed.error) throw new Error(parsed.error);
        } catch (e) { /* skip malformed SSE lines */ }
      }
    }
  }
};
```

### What Changes in the Client

1. **Remove** all direct API calls to Google, OpenAI, Anthropic, Ollama from client code
2. **Remove** `apiKey` and `baseUrl` from `AppConfig` type -- no longer needed client-side
3. **Remove** the `config.apiKey` field from SettingsModal (users no longer enter API keys)
4. **Keep** `provider` and `model` selection in SettingsModal (user still chooses which model)
5. **Add** `user.getAuthJson()` call before every API request to get the current access token
6. **Update** all callers of `streamResponse`, `generateTitle`, `generateSyllabus`, `generateAssessment`, `processDocument` to pass the Stack Auth user instead of config with apiKey

---

## 11. CORS and Security Headers

### Development
- Vite proxy handles everything -- no CORS needed in dev
- Express CORS middleware set to allow `http://localhost:3000`

### Production
```typescript
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN, // e.g., 'https://nexus.example.com'
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'x-stack-access-token'],
}));
```

### Security Headers (helmet-lite, or manual)
```typescript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
```

### Rate Limiting
Consider adding `express-rate-limit` to prevent abuse of the LLM proxy:
```typescript
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  standardHeaders: true,
});

app.use('/api/chat', apiLimiter);
app.use('/api/generate-', apiLimiter);
```

This is optional for initial implementation but recommended before any production deployment.

---

## 12. Request Flow Diagram

```
Client (React)                  Vite Dev Proxy              Express Backend (3001)
     |                               |                              |
     |  POST /api/chat/stream        |                              |
     |  + x-stack-access-token       |                              |
     |------------------------------>|  proxy to localhost:3001      |
     |                               |----------------------------->|
     |                               |                              | 1. requireAuth middleware
     |                               |                              |    - Extract access token
     |                               |                              |    - jose.jwtVerify(token, JWKS)
     |                               |                              |    - Validate aud = project ID
     |                               |                              |    - Reject anon/restricted
     |                               |                              |    - Attach userId to req
     |                               |                              |
     |                               |                              | 2. Route handler
     |                               |                              |    - Read provider from body
     |                               |                              |    - Get API key from env var
     |                               |                              |    - Call upstream LLM API
     |                               |                              |    - Stream response chunks
     |                               |                              |
     |                               |      SSE: data: {"text":"..."} |
     |                               |<-----------------------------|
     |  SSE: data: {"text":"..."}    |                              |
     |<------------------------------|                              |
     |                               |      SSE: data: [DONE]       |
     |                               |<-----------------------------|
     |  SSE: data: [DONE]            |                              |
     |<------------------------------|                              |
```

---

## 13. Open Questions / Deferred Decisions

1. **Production deployment strategy**: Express + Vite static serve vs. separate deployments. Defer until MVP works locally.

2. **Ollama special case**: Ollama runs locally on the user's machine. The backend server proxies to `OLLAMA_BASE_URL`. In production, if backend is remote, Ollama won't be reachable. Consider keeping Ollama calls client-side as a special case, or requiring users to expose Ollama on a reachable URL.

3. **Document processing (base64) size limits**: Large PDFs as base64 can be 5-10MB+. The 10MB limit on `express.json()` should suffice, but monitor.

4. **Multi-provider per user**: Currently all users share the same API keys from env vars. If we want per-user provider configs (e.g., user brings their own OpenAI key), that would require `serverMetadata` storage via Stack Auth REST API. Defer to v2.

5. **Graceful degradation**: If the backend is unreachable, should the frontend fall back to direct API calls (with user-provided API keys)? This is a UX decision. For MVP, show an error.

---

## 14. Implementation Priority

1. **server/config.ts** + **server/index.ts** -- Skeleton server that starts
2. **server/middleware/auth.ts** -- JWT verification
3. **server/routes/health.ts** -- Smoke test endpoint
4. **server/services/llm/google.ts** -- First provider (most commonly used)
5. **server/routes/chat.ts** -- Main streaming endpoint
6. **vite.config.ts** -- Dev proxy
7. **Frontend llmService.ts** -- Rewrite to use proxy
8. **server/services/llm/openai.ts**, **anthropic.ts**, **ollama.ts** -- Remaining providers
9. **server/routes/generate.ts** -- Title, syllabus, assessment endpoints
10. **Data migration utility** -- Client-side migration component
