# Stack Auth Integration Design for Nexus

**Date:** 2026-03-13
**Status:** Approved

## Overview

Integrate Stack Auth into Nexus (a local-first AI learning platform) with a lightweight backend server for secure auth and LLM API key proxying.

## Architecture

### Current State
- No real auth — username string in localStorage
- Fully client-side (React + Vite + AlaSQL)
- LLM API keys stored in client state
- Data scoped by plain username strings

### Target State
- **Backend server** (framework TBD — architect + critic will decide between Express/Hono/etc.)
  - `StackServerApp` for secure auth validation
  - API proxy for LLM calls (Google, OpenAI, Anthropic, Ollama)
  - Server-side API key storage (env vars)
  - Stack Auth secret key secured server-side
- **Frontend**
  - `StackClientApp` with Stack Auth UI components (`<SignIn />`, `<UserButton />`)
  - `useUser()` / `useStackApp()` hooks for auth state
  - No API keys in client — all LLM calls go through backend proxy
- **Data migration**
  - Map old `username` string keys → Stack Auth `user.id` UUIDs
  - One-time migration on first authenticated login
  - Preserve all existing data (chats, notes, syllabus, hive)

## Key Decisions
- Backend handles auth + API key proxy (not full DB migration)
- AlaSQL stays as local storage (no server-side DB)
- Offline graceful degradation with cached auth state
- Old LoginScreen kept as fallback consideration
- Both automated (Vitest) and manual E2E testing

## Team
| Role | Responsibility |
|------|---------------|
| scout | Stack Auth docs expert |
| architect | System design |
| builder | Implementation |
| debugger | Verification |
| tester | Automated + manual tests |
| critic | Devil's advocate |

## Files to Create
- `server/` — Backend server directory
- `server/index.ts` — Server entry point
- `server/auth.ts` — Stack Auth server config
- `server/proxy.ts` — LLM API proxy routes
- `src/stack.ts` — Client-side Stack Auth config
- `src/components/AuthScreen.tsx` — Replaces LoginScreen.tsx

## Files to Modify
- `package.json` — Add @stackframe/stack, server deps
- `index.tsx` — Wrap with StackProvider
- `App.tsx` — Replace localStorage auth with Stack Auth hooks
- `components/ChatInterface.tsx` — Use user.id, remove username prop
- `services/dbService.ts` — Migration utilities
- `services/llmService.ts` — Route calls through backend proxy
- `vite.config.ts` — Proxy config for dev server
