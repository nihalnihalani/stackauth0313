# Proxy API Surface Map

**Purpose:** Document the exact request/response shapes for each backend proxy endpoint, derived from analysis of the current client-side llmService.ts.

## Unified Streaming Protocol

The backend will normalize all provider-specific streaming formats into a single SSE format for the frontend. The frontend only needs to handle one streaming protocol.

### Backend SSE Output Format (all endpoints)
```
data: {"text": "chunk of text here"}
data: {"text": "another chunk"}
data: [DONE]
```

---

## Endpoints

### 1. POST /api/chat/stream

**Purpose:** Proxy streaming chat to any supported provider.

**Auth:** Required - Stack Auth token in `x-stack-access-token: <token>` header.

**Request Body:**
```typescript
{
  provider: 'google' | 'openai' | 'anthropic' | 'ollama';
  model?: string;           // Falls back to provider defaults
  mode: 'direct' | 'socratic';  // Determines system instruction
  baseUrl?: string;         // Only used for openai/ollama custom endpoints
  history: Array<{
    role: 'user' | 'model';
    text: string;
    attachments?: Array<{
      type: 'image' | 'file';
      mimeType: string;
      data: string;        // base64
      name?: string;
    }>;
  }>;
  prompt: string;
  systemInstruction?: string;  // Custom override (used by syllabus/assessment generators)
}
```

**Response:** SSE stream (Content-Type: text/event-stream)

**Provider-Specific Backend Logic:**

#### Google (via @google/genai SDK)
- API key from `GEMINI_API_KEY` env var
- Uses `ai.chats.create()` + `sendMessageStream()`
- Default model: `gemini-3-pro-preview`
- Supports attachments as `inlineData` parts
- History needs role mapping: `model` stays `model`
- System instruction set via config

#### OpenAI (via fetch to REST API)
- API key from `OPENAI_API_KEY` env var
- Endpoint: `${baseUrl || 'https://api.openai.com/v1'}/chat/completions`
- Headers: `Authorization: Bearer ${apiKey}`, `Content-Type: application/json`
- Role mapping: `model` -> `assistant`
- SSE format: `data: {"choices":[{"delta":{"content":"text"}}]}`
- Default model: `gpt-4o`
- Image attachments: `image_url` content type with base64 data URI

#### Anthropic (via fetch to REST API)
- API key from `ANTHROPIC_API_KEY` env var
- Endpoint: `https://api.anthropic.com/v1/messages`
- Headers: `x-api-key`, `anthropic-version: 2023-06-01`
- NO `anthropic-dangerously-allow-browser` header needed server-side
- Role mapping: `model` -> `assistant`
- First message must be `user` role (prepend injection if needed)
- SSE format: `data: {"type":"content_block_delta","delta":{"text":"text"}}`
- Default model: `claude-3-5-sonnet-20240620`
- Image attachments: `image` content block with base64 source

#### Ollama (via fetch to local API)
- No API key needed
- Endpoint: `${baseUrl || 'http://localhost:11434'}/api/chat`
- NDJSON streaming (not SSE): `{"message":{"content":"text"}}`
- Default model: `llama3`
- Image attachments: `images` array with base64 data

---

### 2. POST /api/generate-title

**Purpose:** Generate a concise title from text content.

**Auth:** Required.

**Request Body:**
```typescript
{
  provider: string;
  model?: string;
  content: string;     // Text to generate title from (truncated to 500 chars)
}
```

**Response:** SSE stream (same format). Frontend collects full text.

**Notes:**
- Uses fast model for Google (gemini-2.5-flash)
- Prompt: "Generate a very concise title (3-5 words maximum)..."
- No history needed (empty array)

---

### 3. POST /api/generate-syllabus

**Purpose:** Generate or update a study syllabus from notes.

**Auth:** Required.

**Request Body:**
```typescript
{
  provider: string;
  model?: string;
  notes: Array<{ title: string; content: string }>;
  currentSyllabusJson?: string;  // If updating existing syllabus
}
```

**Response:** SSE stream. Frontend collects full JSON text.

**Notes:**
- System instruction override: "You are an expert academic curriculum designer. You speak only JSON."
- Uses fast model for Google
- Two prompt modes: initial generation vs. update/merge

---

### 4. POST /api/generate-assessment

**Purpose:** Generate quiz questions for a topic.

**Auth:** Required.

**Request Body:**
```typescript
{
  provider: string;
  model?: string;
  topic: string;
  notes: Array<{ title: string; content: string }>;  // Pre-filtered relevant notes
}
```

**Response:** SSE stream. Frontend collects full JSON text.

**Notes:**
- System instruction override: "You are an expert examiner. You output strictly valid JSON arrays of questions."
- Uses fast model for Google
- Generates 5 MCQs

---

### 5. POST /api/process-document

**Purpose:** Extract text from uploaded documents/images.

**Auth:** Required.

**Request Body:**
```typescript
{
  provider: string;
  model?: string;
  attachment: {
    type: 'image' | 'file';
    mimeType: string;
    data: string;    // base64
  };
}
```

**Response:** JSON (not streaming)
```typescript
{
  title: string;
  content: string;
}
```

**Notes:**
- Google: Uses `generateContent` with `responseMimeType: "application/json"`
- Anthropic: Supports both image and document content blocks
- OpenAI: Image only via `image_url`
- Ollama: Not supported (throws error)

---

## Auth Middleware

Every `/api/*` request must include a valid Stack Auth access token:
```
x-stack-access-token: <stack-auth-jwt-access-token>
```

The middleware:
1. Extracts the token from the `x-stack-access-token` header
2. Validates JWT via `jose` library against Stack Auth JWKS endpoint
3. Extracts `user.id` from JWT `sub` claim for request context
4. Returns 401 if invalid/missing/expired

---

## Error Response Format

```typescript
{
  error: string;        // Human-readable error message
  code: string;         // Machine-readable error code
  provider?: string;    // Which LLM provider failed (for proxy errors)
}
```

HTTP Status Codes:
- 400: Bad request (missing required fields)
- 401: Unauthorized (invalid/missing auth token)
- 502: Bad gateway (upstream LLM provider error)
- 503: Service unavailable (provider not configured)
