# HiveMind — Complete Project Analysis

> Collaborative AI Knowledge Base & Cognitive Accelerator for Students and Researchers

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [File Structure](#file-structure)
5. [Core Features](#core-features)
6. [Data Model](#data-model)
7. [AI Provider Integration](#ai-provider-integration)
8. [Components Breakdown](#components-breakdown)
9. [Services Breakdown](#services-breakdown)
10. [Configuration & Environment](#configuration--environment)
11. [How It Works](#how-it-works)
12. [Current Limitations](#current-limitations)
13. [Future Integration: Stack Auth](#future-integration-stack-auth)

---

## Project Overview

**HiveMind** is a browser-based, local-first AI learning platform. It combines multi-model LLM orchestration with a Socratic teaching engine, real-time SVG schematic generation, and a collaborative note-sharing system ("The Hive"). All user data is stored locally in the browser using AlaSQL — no backend server is required beyond the AI provider APIs.

**Key differentiators from standard chatbots:**
- Dual-mode cognition (Direct vs. Socratic)
- Auto-generated SVG blueprints for complex topics
- Compare Mode — dual parallel inference streams
- Syllabus Engine — auto-generates structured curricula from notes
- AI-generated assessments/quizzes
- Peer-to-peer note sharing (local browser DB)
- Full data backup/restore (JSON export/import)

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | React 19.2 | UI framework |
| **Language** | TypeScript 5.8 | Type safety |
| **Build Tool** | Vite 6.2 | Dev server & bundler |
| **Styling** | Tailwind CSS (CDN) | Utility-first CSS |
| **Icons** | Font Awesome 6.4 (CDN) | Icon library |
| **State Management** | TanStack React Query 5 | Data fetching/caching for local DB |
| **Database** | AlaSQL 1.7 (CDN, localStorage) | In-browser SQL database |
| **Markdown** | react-markdown 10.1 | Markdown rendering |
| **Math** | KaTeX (CDN) + remark-math 6 + rehype-katex 7 | LaTeX math rendering |
| **Tables** | remark-gfm 4 | GitHub Flavored Markdown tables |
| **Charts/SVG** | D3.js 7.9 | Data visualization (imported but SVGs are AI-generated) |
| **AI SDK** | @google/genai 1.31 | Google Gemini API client |

### CDN Dependencies (loaded in `index.html`)

- `tailwindcss` — Styling
- `font-awesome` — Icons
- `katex` — Math rendering CSS
- `alasql` — In-browser SQL database

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Client)                  │
│                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  React   │  │  TanStack    │  │   AlaSQL      │  │
│  │  App     │──│  React Query │──│  (localStorage)│  │
│  │          │  │  (caching)   │  │               │  │
│  └────┬─────┘  └──────────────┘  └───────────────┘  │
│       │                                              │
│  ┌────┴──────────────────────────────────────────┐   │
│  │              llmService.ts                     │   │
│  │  ┌─────────┬──────────┬──────────┬─────────┐  │   │
│  │  │ Google  │ OpenAI   │Anthropic │ Ollama  │  │   │
│  │  │ Gemini  │ GPT-4o   │ Claude   │ Local   │  │   │
│  │  └────┬────┴────┬─────┴────┬─────┴────┬────┘  │   │
│  └───────┼─────────┼──────────┼──────────┼───────┘   │
└──────────┼─────────┼──────────┼──────────┼───────────┘
           │         │          │          │
     ┌─────▼───┐ ┌───▼────┐ ┌──▼─────┐ ┌──▼──────┐
     │ Gemini  │ │ OpenAI │ │Anthropic│ │ Ollama  │
     │ API     │ │ API    │ │ API    │ │ Local   │
     └─────────┘ └────────┘ └────────┘ └─────────┘
```

### Data Flow

1. **User types prompt** → `InputArea` component
2. **Prompt sent** → `ChatInterface` dispatches to `llmService.streamResponse()`
3. **LLM Service** routes to correct provider based on `AppConfig.provider`
4. **Response streams** back chunk-by-chunk via `onChunk` callback
5. **Messages saved** → `dbService.saveMessage()` → AlaSQL → localStorage
6. **UI updates** reactively via React state

---

## File Structure

```
stackauth0313/
├── index.html              # Entry HTML — loads CDN deps (Tailwind, AlaSQL, KaTeX, FA)
├── index.tsx               # React entry — initializes DB, QueryClient, renders <App />
├── App.tsx                 # Root component — login gate, routes to ChatInterface or LoginScreen
├── types.ts                # TypeScript interfaces (Message, ChatSession, Note, AppConfig, QuizQuestion)
├── constants.ts            # Model IDs, provider constants, system instructions (Direct + Socratic)
├── vite.config.ts          # Vite config — port 3000, env injection (GEMINI_API_KEY)
├── tsconfig.json           # TypeScript config — ES2022, React JSX, bundler module resolution
├── package.json            # Dependencies and scripts (dev, build, preview)
├── metadata.json           # App metadata (name, description, permissions)
│
├── services/
│   ├── dbService.ts        # AlaSQL database layer — CRUD for chats, messages, notes, syllabus, hive, users
│   └── llmService.ts       # Multi-provider LLM orchestration — streaming, document processing, titles, syllabus, quizzes
│
├── components/
│   ├── LoginScreen.tsx     # Username-based login (no auth — just localStorage identity)
│   ├── ChatInterface.tsx   # Main chat UI — message handling, streaming, compare mode, forking
│   ├── InputArea.tsx       # Prompt input — file attachments, compare toggle, send/stop controls
│   ├── MessageList.tsx     # Message rendering — user/model bubbles, archive/fork actions, SVG detection
│   ├── MarkdownRenderer.tsx# Markdown rendering with math (KaTeX), GFM tables, code highlighting
│   ├── CodeBlock.tsx       # Code block with copy button + SVG detection (opens SvgModal)
│   ├── SvgModal.tsx        # Full-screen SVG blueprint viewer
│   ├── SettingsModal.tsx   # Provider/model/API key configuration UI
│   ├── HistoryModal.tsx    # Chat session history — list, select, delete sessions
│   ├── NotesModal.tsx      # Notes management — view, search, create, delete, import docs, transmit
│   ├── HiveModal.tsx       # Peer note transmission — incoming notes inbox, accept/reject
│   ├── SyllabusModal.tsx   # AI-generated syllabus — build from notes, fork topics to chat, trigger quizzes
│   ├── AssessmentModal.tsx # AI-generated MCQ quiz — answer, score, explanations
│   └── LiveInterface.tsx   # Live audio interface (Gemini native audio preview)
│
├── .env                    # Environment variables (GEMINI_API_KEY, etc.)
├── .gitignore              # Git ignore rules
├── CLAUDE.md               # Claude Code project rules
├── README.md               # Original project README
├── stack-auth-docs.md      # Stack Auth documentation reference
└── HIVEMIND.md             # This file — complete project analysis
```

---

## Core Features

### 1. Dual-Mode Cognition

| Mode | Prefix | Behavior |
|------|--------|----------|
| **DIRECT** | `>` | Standard high-speed interaction — info retrieval, coding, drafting |
| **SOCRATIC** | `?` | Pedagogical engine — never gives direct answers, guides through questioning |

Mode is toggled in the UI and changes the system instruction sent to the LLM. The Socratic instruction enforces:
- Automatic evaluation of student answers
- Never giving direct answers
- Guided discovery through smaller questions
- Prerequisite knowledge checks
- Celebration of breakthroughs

### 2. Dynamic SVG Schematic Rendering

When topics involve architecture, flows, or systems, the AI generates raw SVG blueprints. The system instruction enforces:
- `viewBox="0 0 800 600"` (4:3 aspect ratio)
- Technical blueprint / HUD style (white on black)
- Lines drawn FIRST, nodes LAST (proper z-ordering)
- Anti-overlap: every text label gets a black background rect
- Min 180-unit spacing between nodes

SVGs are detected in code blocks (language `svg`) by `CodeBlock.tsx` and can be viewed full-screen via `SvgModal.tsx`.

### 3. Compare Mode

Triggers **two parallel inference streams** simultaneously. Results displayed side-by-side. Useful for:
- Comparing code implementations
- Creative writing variations
- Hallucination detection

### 4. Syllabus Engine

Analyzes saved notes to build a hierarchical JSON syllabus:
```json
{
  "title": "Course Title",
  "modules": [
    {
      "title": "Module Name",
      "topics": [
        {
          "title": "Topic Name",
          "subtopics": ["Detail 1", "Detail 2"]
        }
      ]
    }
  ]
}
```

Features:
- **Incremental updates**: New notes merge into existing syllabus structure
- **Fork-to-Learn**: Click any topic to spawn a new chat session for that subject
- **Assessment trigger**: Generate quizzes from any syllabus topic

### 5. AI-Generated Assessments

- Select a topic from the syllabus
- AI reads relevant notes on that topic
- Generates 5 MCQ questions with explanations
- Tracks score and shows correct answers

### 6. Neural Archives (Notes)

- **One-Click Archive**: Save any chat message as a note
- **Auto-Titling**: AI generates semantic title from content
- **Document Import**: Drag/drop PDFs or images — AI extracts text to Markdown
- **Search**: Full-text search across all notes
- **Peer Transmission**: Send notes to other users in the local browser DB

### 7. The Hive (Peer Sharing)

- Send notes to other usernames
- Recipients see incoming notes in the Hive inbox
- Accept (saves to their notes) or reject transmissions
- All data stays in localStorage — users must share the same browser/device

### 8. Chat Control Flow

- **Branching/Forking**: Fork any message to create a new session from that point
- **Stop & Regenerate**: Halt generation, regenerate with same or different settings
- **Session History**: Browse, select, delete past sessions

### 9. Live Audio Interface

Experimental real-time audio interface using Gemini's native audio model (`gemini-2.5-flash-native-audio-preview`). Component exists in `LiveInterface.tsx`.

### 10. Backup & Restore

- **Export**: Download entire user's database as JSON file
- **Import**: Upload JSON backup — replaces current user's data
- Format version 4, includes chats, messages, notes, syllabus

---

## Data Model

### Database: AlaSQL (localStorage-backed)

#### Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| `users` | `username` (PK), `lastLogin` | User registry |
| `chats` | `id` (PK), `title`, `timestamp`, `username` | Chat sessions |
| `messages` | `id` (PK), `chatId` (FK), `role`, `text`, `timestamp`, `comparisonText`, `attachments` | Chat messages |
| `notes` | `id` (PK), `title`, `content`, `timestamp`, `username` | Saved notes |
| `syllabus` | `id` (PK), `content`, `noteCount`, `timestamp`, `username` | Generated syllabus (JSON string) |
| `hive_transmissions` | `id` (PK), `title`, `content`, `sender`, `recipient`, `timestamp` | Peer note transfers |

#### TypeScript Types

```typescript
interface Message {
  id: string;
  chatId?: string;
  role: 'user' | 'model' | 'system';
  text: string;
  comparisonText?: string;   // Second response in Compare Mode
  timestamp?: number;
  attachments?: Attachment[];
}

interface Attachment {
  type: 'image' | 'file';
  mimeType: string;
  data: string;              // base64 encoded
  name?: string;
}

interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
}

interface Note {
  id: string;
  title: string;
  content: string;
  timestamp: number;
}

interface AppConfig {
  provider: string;          // 'google' | 'openai' | 'anthropic' | 'ollama'
  apiKey: string;
  baseUrl: string;
  model: string;
  mode: string;              // 'direct' | 'socratic'
  systemInstruction?: string;
}

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswerIndex: number; // 0-3
  explanation: string;
}
```

---

## AI Provider Integration

### Provider Routing (`llmService.ts`)

All LLM calls go through `streamResponse()` which routes to the correct provider:

| Provider | Function | API Endpoint | Auth | Streaming |
|----------|----------|-------------|------|-----------|
| **Google Gemini** | `callGoogle()` | `@google/genai` SDK | `GEMINI_API_KEY` env var | SDK iterator |
| **OpenAI** | `callOpenAI()` | `https://api.openai.com/v1/chat/completions` | `Authorization: Bearer` header | SSE (`data:` lines) |
| **Anthropic** | `callAnthropic()` | `https://api.anthropic.com/v1/messages` | `x-api-key` header | SSE (`data:` lines) |
| **Ollama** | `callOllama()` | `http://localhost:11434/api/chat` | None (local) | NDJSON stream |

### Google Gemini Models

| Constant | Model ID | Purpose |
|----------|----------|---------|
| `THINKING` | `gemini-3-pro-preview` | Deep reasoning (default) |
| `FAST` | `gemini-2.5-flash` | Fast tasks, title generation, syllabus, quizzes |
| `IMAGE_GEN` | `gemini-3-pro-image-preview` | Image generation |
| `IMAGE_EDIT` | `gemini-2.5-flash-image` | Image editing |
| `LIVE_AUDIO` | `gemini-2.5-flash-native-audio-preview-09-2025` | Real-time audio |

### API Key Handling

- **Google Gemini**: Uses `GEMINI_API_KEY` from `.env` via Vite's `define` (injected as `process.env.API_KEY` and `process.env.GEMINI_API_KEY`). Falls back to manual entry in Settings modal.
- **OpenAI/Anthropic/Ollama**: Configured manually in the Settings modal at runtime. Keys stored in React state (not persisted).

### LLM Service Functions

| Function | Purpose |
|----------|---------|
| `streamResponse()` | Main chat — streams AI response chunk-by-chunk |
| `processDocument()` | Extracts text from PDF/image attachments, returns `{title, content}` |
| `generateTitle()` | Generates 3-5 word title for notes (uses FAST model) |
| `generateSyllabus()` | Builds/updates hierarchical JSON syllabus from notes |
| `generateAssessment()` | Generates 5 MCQ questions for a given topic |

---

## Components Breakdown

### `App.tsx` — Root Component
- Checks `localStorage` for `hivemind_user`
- Shows `LoginScreen` if no user, `ChatInterface` if logged in
- Handles login (stores username) and logout (clears username)

### `LoginScreen.tsx` — Username Entry
- Simple username input (no password, no real auth)
- Cyberpunk terminal aesthetic
- Calls `ensureUserExists()` on login

### `ChatInterface.tsx` — Main Chat (19KB, largest component)
- Manages all chat state: messages, sessions, config, modals
- Handles message streaming with abort support
- Compare Mode: runs two parallel streams
- Auto-titles new sessions after first exchange
- Fork functionality: creates new session from any message point
- Archiving: saves messages as notes
- Controls all modal visibility (settings, history, notes, hive, syllabus, assessment, SVG, live)

### `InputArea.tsx` — Prompt Input
- Text input with file attachment (images, PDFs)
- Compare Mode toggle button
- Send / Stop buttons
- File preview with remove option
- Reads files as base64 for attachment

### `MessageList.tsx` — Message Display
- Renders user and model messages
- Shows Compare Mode split view
- Archive button on model messages
- Fork button on any message
- Loading indicator during streaming
- SVG detection delegated to MarkdownRenderer → CodeBlock

### `MarkdownRenderer.tsx` — Rich Content Rendering
- react-markdown with plugins: remark-math, rehype-katex, remark-gfm
- Custom code block renderer → `CodeBlock`
- Handles inline math and block math

### `CodeBlock.tsx` — Code Blocks
- Syntax-highlighted code display
- Copy-to-clipboard button
- **SVG detection**: If language is `svg`, renders the SVG inline and adds "View Full" button → opens `SvgModal`

### `SvgModal.tsx` — SVG Viewer
- Full-screen overlay for viewing AI-generated SVG blueprints
- Renders raw SVG via `dangerouslySetInnerHTML`

### `SettingsModal.tsx` — Configuration
- Provider selector (Google, OpenAI, Anthropic, Ollama)
- API key input (password field)
- Model name input (with provider-specific placeholders)
- Base URL input (shown for OpenAI and Ollama only)

### `HistoryModal.tsx` — Session History
- Lists all chat sessions for the current user
- Click to switch sessions
- Delete sessions
- Shows session titles and timestamps

### `NotesModal.tsx` — Notes Management (13KB)
- List all notes with search
- View individual note content
- Delete notes
- Import documents (file upload → AI extraction)
- Transmit notes to other users (The Hive)
- Create new notes manually

### `HiveModal.tsx` — Peer Sharing Inbox
- Shows incoming note transmissions
- Accept: saves to user's notes
- Reject: deletes the transmission
- Shows sender name, title, timestamp

### `SyllabusModal.tsx` — Curriculum Builder (12KB)
- Generates syllabus from all notes (or updates existing)
- Displays hierarchical tree: Modules → Topics → Subtopics
- Fork-to-Learn: click topic → new chat session
- Quiz trigger: click topic → generate assessment
- Shows note count and last update time

### `AssessmentModal.tsx` — Quiz Interface (8KB)
- Displays AI-generated MCQ questions
- Tracks selected answers
- Submit → shows score and explanations
- Color-coded: correct (green), incorrect (red)
- Shows correct answer when wrong

### `LiveInterface.tsx` — Audio Interface (13KB)
- Experimental real-time audio chat with Gemini
- WebSocket-based communication
- Microphone input → audio stream → AI response
- Audio playback of responses

---

## Services Breakdown

### `dbService.ts` — Database Layer

**Database**: AlaSQL with localStorage persistence

**Initialization**: Creates tables on first load, runs migrations for schema changes

| Category | Functions |
|----------|----------|
| **Setup** | `initDB()` — Creates tables, runs migrations |
| **Users** | `ensureUserExists()`, `checkUserExists()` |
| **Chats** | `createChatSession()`, `getChatSessions()`, `updateChatTitle()`, `deleteChatSession()` |
| **Messages** | `saveMessage()`, `getMessagesByChatId()` |
| **Notes** | `saveNote()`, `getNotes()`, `deleteNote()`, `searchNotes()` |
| **Hive** | `sendHiveNote()`, `getHiveTransmissions()`, `deleteHiveTransmission()` |
| **Syllabus** | `saveSyllabus()`, `getSyllabus()` |
| **Backup** | `exportBackup()`, `importBackup()` |

### `llmService.ts` — LLM Orchestration

**Pattern**: Provider-agnostic interface with streaming support

| Function | Input | Output | Notes |
|----------|-------|--------|-------|
| `streamResponse()` | config, history, prompt, onChunk, signal | void (streams via callback) | Main chat function |
| `processDocument()` | config, attachment | `{title, content}` | PDF/image text extraction |
| `generateTitle()` | config, content | string | Auto-titles notes (uses FAST model) |
| `generateSyllabus()` | config, notes, onChunk, existingSyllabus? | void (streams JSON) | Builds/updates curriculum |
| `generateAssessment()` | config, topic, notes, onChunk | void (streams JSON) | Generates MCQ quiz |

---

## Configuration & Environment

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes (for Google) | — | Google Gemini API key |

The Vite config injects this as `process.env.API_KEY` and `process.env.GEMINI_API_KEY` at build time.

Other providers (OpenAI, Anthropic, Ollama) are configured at runtime through the Settings modal — keys are held in React state only.

### Vite Configuration

```typescript
{
  server: { port: 3000, host: '0.0.0.0' },
  plugins: [react()],
  define: {
    'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } }
}
```

### Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite` | Start dev server on port 3000 |
| `build` | `vite build` | Production build |
| `preview` | `vite preview` | Preview production build |

---

## How It Works

### User Flow

1. **Login**: Enter a username → stored in `localStorage` as `hivemind_user`
2. **Chat**: Type a prompt → AI streams a response → messages saved to AlaSQL
3. **Archive**: Hover a message → click "Archive" → AI generates title → saved as note
4. **Import**: Click paperclip → upload PDF/image → AI extracts text → saved as note
5. **Syllabus**: Open Syllabus modal → AI analyzes all notes → generates hierarchical curriculum
6. **Quiz**: Click a syllabus topic → AI generates 5 MCQs based on your notes
7. **Share**: Open Notes → select a note → click "Transmit" → enter recipient username
8. **Receive**: Open Hive → see incoming transmissions → Accept or Reject
9. **Backup**: Settings → Export → downloads JSON file with all your data
10. **Restore**: Settings → Import → upload JSON backup → replaces your data

### Authentication (Current State)

**There is NO real authentication.** The login screen accepts any username string. Data is sandboxed by username in the AlaSQL tables, but there's no password, no token, no server-side verification. This is the key area where Stack Auth integration would add value.

---

## Current Limitations

1. **No real authentication** — Username-only login, no passwords or OAuth
2. **Local-only data** — Everything in localStorage, no cloud sync
3. **Hive sharing is same-browser only** — Both sender and recipient must use the same browser/device (shared localStorage)
4. **No data encryption** — localStorage data is plaintext
5. **API keys in state only** — Non-Google keys aren't persisted between sessions
6. **CDN dependencies** — Tailwind, AlaSQL, KaTeX, Font Awesome loaded from CDNs (no offline support)
7. **No SSR** — Client-only React app
8. **No tests** — No test suite exists
9. **Large component files** — `ChatInterface.tsx` (19KB) could be decomposed

---

## Future Integration: Stack Auth

The `.env` file includes placeholder variables for Stack Auth integration. This would solve:

| Current Problem | Stack Auth Solution |
|-----------------|---------------------|
| No real auth | Email/password, OAuth, magic link, passkey sign-in |
| Username-only login | Verified user identity with JWT tokens |
| Local-only data | User identity persists across devices |
| No access control | RBAC permissions for shared content |
| Same-browser sharing | Server-side user lookup for Hive transmissions |
| No user profiles | Full user profile with metadata |

### Recommended Integration Points

1. **Replace `LoginScreen.tsx`** with Stack Auth's `<SignIn />` / `<SignUp />` components
2. **Replace `ensureUserExists()`** with Stack Auth's `useUser()` hook
3. **Use `user.id`** instead of username string for all DB operations
4. **Add `<UserButton />`** to the chat header for profile/signout
5. **Move API key storage** to `user.serverMetadata` (encrypted, persistent)
6. **Add Teams** for study groups — share notes via Stack Auth teams instead of local Hive
7. **Use Stack Auth Payments** for premium features (more API calls, advanced models)

### Key Environment Variables for Stack Auth

```env
NEXT_PUBLIC_STACK_PROJECT_ID=<from Stack Auth dashboard>
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=<from Stack Auth dashboard>
STACK_SECRET_SERVER_KEY=<from Stack Auth dashboard — keep secret>
```

---

*Generated from complete codebase analysis of the HiveMind project.*
