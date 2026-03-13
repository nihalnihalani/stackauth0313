# Nexus + Stack Auth Integration - Test Plan

## Overview

This test plan covers the integration of Stack Auth into the Nexus application, replacing the current localStorage-based username authentication with a proper auth system. It validates auth flows, protected routes, user data persistence, component rendering, edge cases, migration, and feature regression.

---

## Current Auth Architecture (Pre-Stack Auth)

- **Login**: User enters a username string in `LoginScreen.tsx` -> stored in `localStorage` as `nexus_user`
- **Session**: `App.tsx` checks `localStorage.getItem('nexus_user')` on load
- **Logout**: Removes `nexus_user` from localStorage
- **User identity**: Plain username string passed as prop to `ChatInterface`
- **Data storage**: AlaSQL (in-browser SQL) with tables keyed by `username` string
- **No password, no email, no tokens** - just a username string

## Target Auth Architecture (Post-Stack Auth)

- **Login**: Stack Auth `<SignIn />` or `<CredentialSignIn />` component
- **Session**: Stack Auth SDK manages tokens, cookies, and session state
- **Logout**: `user.signOut()` via Stack Auth SDK
- **User identity**: Stack Auth `User` object with `id`, `displayName`, `primaryEmail`
- **Protected routes**: `useUser({ or: 'redirect' })` pattern
- **Provider**: `<StackProvider>` and `<StackTheme>` wrapping the app in `index.tsx`

---

## Test Categories

### 1. Auth Flow Tests

#### 1.1 Sign-Up Flow
- [ ] **T-AUTH-01**: Sign-up form renders correctly with email and password fields
- [ ] **T-AUTH-02**: Sign-up with valid email and password succeeds
- [ ] **T-AUTH-03**: Sign-up with invalid email format shows error
- [ ] **T-AUTH-04**: Sign-up with weak password shows validation error
- [ ] **T-AUTH-05**: Sign-up with already-registered email shows appropriate error
- [ ] **T-AUTH-06**: After successful sign-up, user is redirected to main app (ChatInterface)
- [ ] **T-AUTH-07**: OAuth sign-up buttons render if configured (Google, GitHub, etc.)

#### 1.2 Sign-In Flow
- [ ] **T-AUTH-08**: Sign-in form renders correctly
- [ ] **T-AUTH-09**: Sign-in with valid credentials succeeds
- [ ] **T-AUTH-10**: Sign-in with wrong password shows error
- [ ] **T-AUTH-11**: Sign-in with non-existent email shows error
- [ ] **T-AUTH-12**: After successful sign-in, user lands on ChatInterface
- [ ] **T-AUTH-13**: Session persists across page reload (user stays logged in)
- [ ] **T-AUTH-14**: OAuth sign-in buttons render if configured

#### 1.3 Sign-Out Flow
- [ ] **T-AUTH-15**: Logout button (power-off icon) triggers `user.signOut()`
- [ ] **T-AUTH-16**: After sign-out, user is redirected to sign-in page
- [ ] **T-AUTH-17**: After sign-out, revisiting the app shows sign-in (not ChatInterface)
- [ ] **T-AUTH-18**: After sign-out, localStorage auth data is cleared

#### 1.4 Forgot Password Flow
- [ ] **T-AUTH-19**: Forgot password link is accessible from sign-in form
- [ ] **T-AUTH-20**: Entering email sends password reset email
- [ ] **T-AUTH-21**: Password reset with valid token succeeds
- [ ] **T-AUTH-22**: Password reset with expired/invalid token shows error

---

### 2. Protected Route Tests

- [ ] **T-ROUTE-01**: Unauthenticated user visiting `/` is redirected to sign-in
- [ ] **T-ROUTE-02**: Authenticated user visiting `/` sees ChatInterface
- [ ] **T-ROUTE-03**: `useUser({ or: 'redirect' })` correctly redirects when no session
- [ ] **T-ROUTE-04**: `useUser()` returns null for unauthenticated users (without redirect option)
- [ ] **T-ROUTE-05**: Stack Auth handler routes (`/handler/sign-in`, `/handler/sign-up`, etc.) are accessible

---

### 3. User Data & Identity Tests

#### 3.1 User Object
- [ ] **T-USER-01**: `useUser()` returns a valid Stack Auth user object after login
- [ ] **T-USER-02**: User has `id` (unique identifier), `displayName`, and `primaryEmail`
- [ ] **T-USER-03**: User `displayName` is displayed in the UI where `username` was previously shown (status line, etc.)
- [ ] **T-USER-04**: User `id` is used for DB operations instead of raw username string

#### 3.2 User Data Persistence
- [ ] **T-DATA-01**: Chat sessions are stored with Stack Auth user ID
- [ ] **T-DATA-02**: Notes are stored with Stack Auth user ID
- [ ] **T-DATA-03**: Syllabus data is stored with Stack Auth user ID
- [ ] **T-DATA-04**: Hive transmissions use Stack Auth user ID for sender/recipient
- [ ] **T-DATA-05**: Data from one user is NOT accessible by another user

---

### 4. Component Rendering Tests

#### 4.1 App Component
- [ ] **T-COMP-01**: `<StackProvider>` wraps the entire app in `index.tsx`
- [ ] **T-COMP-02**: App shows sign-in when user is not authenticated
- [ ] **T-COMP-03**: App shows ChatInterface when user is authenticated
- [ ] **T-COMP-04**: App correctly passes user identity to ChatInterface

#### 4.2 ChatInterface Component
- [ ] **T-COMP-05**: ChatInterface renders with authenticated user's display name in status bar
- [ ] **T-COMP-06**: All modals still open correctly (Settings, History, Notes, Syllabus, Hive, Live)
- [ ] **T-COMP-07**: Mode toggle (Direct/Socratic) still works
- [ ] **T-COMP-08**: Model toggle (Gemini 3/2.5) still works
- [ ] **T-COMP-09**: New session button works
- [ ] **T-COMP-10**: Logout button triggers Stack Auth sign-out

#### 4.3 LoginScreen Replacement
- [ ] **T-COMP-11**: Old `LoginScreen.tsx` is no longer used OR is replaced with Stack Auth components
- [ ] **T-COMP-12**: Stack Auth sign-in components match the cyberpunk/dark theme of Nexus

#### 4.4 SettingsModal
- [ ] **T-COMP-13**: SettingsModal still opens and displays provider configuration
- [ ] **T-COMP-14**: Config changes still persist in localStorage
- [ ] **T-COMP-15**: User account settings (if added via Stack Auth `<AccountSettings />`) work

---

### 5. Edge Case Tests

#### 5.1 Token & Session Edge Cases
- [ ] **T-EDGE-01**: Expired access token is auto-refreshed by Stack Auth SDK
- [ ] **T-EDGE-02**: If refresh fails, user is redirected to sign-in
- [ ] **T-EDGE-03**: Multiple browser tabs maintain consistent auth state
- [ ] **T-EDGE-04**: Opening the app after token expiry (e.g., next day) handles gracefully

#### 5.2 Network Error Edge Cases
- [ ] **T-EDGE-05**: Network failure during sign-in shows appropriate error message
- [ ] **T-EDGE-06**: Network failure during sign-up shows appropriate error message
- [ ] **T-EDGE-07**: Stack Auth API being unreachable is handled gracefully (not a white screen)
- [ ] **T-EDGE-08**: Intermittent connectivity doesn't corrupt auth state

#### 5.3 Invalid State Edge Cases
- [ ] **T-EDGE-09**: Manually cleared cookies/localStorage triggers re-authentication
- [ ] **T-EDGE-10**: Tampered JWT token is rejected
- [ ] **T-EDGE-11**: Accessing the app with an old/stale localStorage `nexus_user` key doesn't bypass Stack Auth
- [ ] **T-EDGE-12**: Browser back button after logout doesn't show authenticated content

---

### 6. Migration Tests

#### 6.1 Existing Data Migration
- [ ] **T-MIG-01**: Existing AlaSQL data (chats, notes, syllabus) still accessible after auth change
- [ ] **T-MIG-02**: Users who had data under old `username` system can still access it
- [ ] **T-MIG-03**: `dbService.ts` functions still work with new user identity format
- [ ] **T-MIG-04**: Backup/restore (export/import) still works with new auth system

#### 6.2 Config Migration
- [ ] **T-MIG-05**: Existing `nexus_config` in localStorage is still read correctly
- [ ] **T-MIG-06**: No orphaned `nexus_user` keys interfere with Stack Auth session

---

### 7. Feature Regression Tests

These verify that existing features work correctly after the auth integration.

#### 7.1 Chat Features
- [ ] **T-REG-01**: Sending a message works (text input + execute button)
- [ ] **T-REG-02**: Streaming responses display chunk-by-chunk
- [ ] **T-REG-03**: Compare mode (dual responses) works
- [ ] **T-REG-04**: Stop generation works
- [ ] **T-REG-05**: Regenerate response works
- [ ] **T-REG-06**: Fork conversation works
- [ ] **T-REG-07**: Archive message to notes works
- [ ] **T-REG-08**: File attachments (image/PDF) work

#### 7.2 Notes Features
- [ ] **T-REG-09**: Notes modal opens and lists notes for authenticated user
- [ ] **T-REG-10**: Search notes works
- [ ] **T-REG-11**: Delete note works
- [ ] **T-REG-12**: Import document (PDF/image) to notes works
- [ ] **T-REG-13**: Transmit note to another user works (Hive)

#### 7.3 Syllabus Features
- [ ] **T-REG-14**: Syllabus modal generates curriculum from notes
- [ ] **T-REG-15**: Syllabus caching works (re-uses cached version when note count unchanged)
- [ ] **T-REG-16**: Fork from syllabus topic starts new session
- [ ] **T-REG-17**: Assessment quiz generation works from syllabus

#### 7.4 History Features
- [ ] **T-REG-18**: History modal shows sessions for authenticated user
- [ ] **T-REG-19**: Selecting a session loads its messages
- [ ] **T-REG-20**: Deleting a session works
- [ ] **T-REG-21**: Backup DB (export) works
- [ ] **T-REG-22**: Restore DB (import) works

#### 7.5 Hive Features
- [ ] **T-REG-23**: Hive modal shows incoming transmissions for authenticated user
- [ ] **T-REG-24**: Accepting a transmission saves it as a note
- [ ] **T-REG-25**: Deleting a transmission works
- [ ] **T-REG-26**: Hive notification badge appears when there are transmissions

#### 7.6 Live Voice
- [ ] **T-REG-27**: Live interface opens and attempts connection
- [ ] **T-REG-28**: Live interface uses authenticated user's name in system prompt

#### 7.7 SVG & Markdown
- [ ] **T-REG-29**: SVG schematics render inline in messages
- [ ] **T-REG-30**: SVG modal expands on click
- [ ] **T-REG-31**: Markdown rendering with math (KaTeX) works
- [ ] **T-REG-32**: Code blocks with copy button work

---

### 8. Security Tests

- [ ] **T-SEC-01**: No access tokens are exposed in URL parameters
- [ ] **T-SEC-02**: API keys in config are not leaked to Stack Auth or external services
- [ ] **T-SEC-03**: Stack Auth tokens are not stored in localStorage (SDK manages securely)
- [ ] **T-SEC-04**: CORS headers are properly configured for Stack Auth API calls
- [ ] **T-SEC-05**: No XSS vulnerabilities introduced by Stack Auth component integration
- [ ] **T-SEC-06**: Password inputs use `type="password"` and are not logged

---

## Test Implementation Strategy

### Phase 1: Setup
1. Install Vitest + @testing-library/react + jsdom
2. Configure Vitest in `vite.config.ts` or `vitest.config.ts`
3. Create mock for Stack Auth SDK (`@stackframe/stack`)
4. Create mock for AlaSQL (global `alasql`)
5. Set up test utilities (render with providers, mock user factory)

### Phase 2: Unit Tests
- Component rendering tests (does it render without crashing?)
- Auth state conditional rendering (signed in vs. signed out)
- User identity propagation through components

### Phase 3: Integration Tests
- Auth flow: sign-in -> see chat -> sign-out -> see login
- Data persistence: create chat -> sign-out -> sign-in -> chat still exists
- Feature flows: send message -> archive -> see in notes

### Phase 4: Manual Testing Checklist
- Actual browser testing with real Stack Auth project
- OAuth flow testing (requires real OAuth provider config)
- Password reset email flow (requires email server)
- Multi-tab testing
- Mobile responsiveness after auth integration

---

## Test File Structure

```
tests/
  setup.ts                    # Global test setup (mocks, providers)
  mocks/
    stack-auth.ts             # Mock for @stackframe/stack
    alasql.ts                 # Mock for alasql
  unit/
    App.test.tsx              # App component auth state tests
    ChatInterface.test.tsx    # ChatInterface rendering tests
    LoginScreen.test.tsx      # LoginScreen / Stack Auth component tests
    dbService.test.ts         # DB service with new user identity
  integration/
    auth-flow.test.tsx        # Full sign-in/sign-up/sign-out flow
    data-persistence.test.tsx # Data access across auth states
    feature-regression.test.tsx # Core features still work
  e2e/
    (manual checklist)        # Documented manual test procedures
```

---

## Environment Variables Required for Testing

```env
NEXT_PUBLIC_STACK_PROJECT_ID=test-project-id
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=test-publishable-key
STACK_SECRET_SERVER_KEY=test-secret-key  # Only for server-side tests
```

---

## Success Criteria

- All unit tests pass (green)
- All integration tests pass (green)
- No regression in existing features (manual verification)
- Auth flows work end-to-end in browser
- TypeScript compiles without errors (`npx tsc --noEmit`)
- No security issues identified in code review

---

## Dependencies for Testing

```json
{
  "devDependencies": {
    "vitest": "^3.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "jsdom": "^25.0.0"
  }
}
```
