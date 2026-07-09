# Plan: Home page sign-in/sign-up entry point

Date: 2026-07-09
Status: draft

## Summary
Add a session-aware entry point on the home page that links to `/register` for a logged-out visitor. Since `/register` today only supports creating a new teacher account (no login exists anywhere in the app), extend it with a "Sign up" / "Log in" tab toggle so the same destination covers both flows, per the design agreed in brainstorming (no separate spec doc written — small feature, design approved inline). Login and sign-out use the existing Supabase browser client directly (`supabase.auth.signInWithPassword` / `signOut`) — no new route or endpoint, matching the "Supabase handles auth" convention already used elsewhere in the app. "Done" means: a logged-out visitor sees "Sign in / Sign up" → `/register`, can either register (existing flow) or log in (new) and land on `/profile`; a logged-in visitor sees "My profile" → `/profile` instead, and can sign out from there back to the logged-out home state.

## Assumptions
- Design decided in this session's brainstorm: same-page tab toggle on `/register` (not a separate `/login` route or a `?mode=` query param) — see chat for the rejected alternatives.
- Post-login redirect target is `/profile`, matching the existing post-register redirect in `RegisterForm.tsx`.
- Login/sign-out failures show one generic message ("Invalid email or password") — no per-field errors, to match Supabase's own generic auth error and avoid user enumeration.
- Password reset / "forgot password" is out of scope for this pass.
- No other in-flight worktree touches these files — checked `git worktree list` + `git log main..<branch>` for `dashboard-task-1`, `profile-completion`, `lesson-booking-plan`, `stripe-checkout-plan`, `embed-brainstorming-planner`; none have commits ahead of `main` that touch `app/page.tsx`, `app/register/*`, or `app/profile/*`.
- `lib/supabase/client.ts` (browser client) and `lib/supabase/server.ts` (server client) already exist and are reused as-is — no changes needed to either.
- ⚠️ POST-HOC (Task 2): `RegisterForm` and `page.tsx` were split into a new client wrapper `app/register/AuthTabs.tsx` holding the tab state, since `page.tsx` needed to stay a server component for its `metadata` export. `LoginForm.tsx` uses a small local (unexported) zod schema for email/password rather than a shared schema file, matching `RegisterForm`'s validation style without introducing a new shared module for two fields.

## Tasks

### 1. Auth-aware entry point on the home page
- **Goal:** Home page (`app/page.tsx`) shows "Sign in / Sign up" → `/register` when logged out, or "My profile" → `/profile` when logged in.
- **Steps:**
  1. Reuse the server-side Supabase client already created in `app/page.tsx` (for listing teachers) to call `supabase.auth.getUser()`.
  2. Add a small header/button area to the page with a conditional `Link`: no user → "Sign in / Sign up" to `/register`; user present → "My profile" to `/profile`.
  3. Match existing button styling conventions (see the `rounded-full bg-foreground` button in `app/profile/page.tsx`).
- **Acceptance:** visiting `/` logged out shows "Sign in / Sign up" linking to `/register`; logged in (via the existing register flow) shows "My profile" linking to `/profile`.
- **Depends on:** none.
- **Status:** done
- **Completed:** 2026-07-09

### 2. Login capability on `/register` (tab toggle + LoginForm)
- **Goal:** Let an existing teacher log in from the same `/register` page via a tab toggle, without adding a new route or endpoint.
- **Steps:**
  1. Add a local-state tab toggle to the `/register` page ("Sign up" default / "Log in") — a thin client wrapper is fine since `RegisterForm` is already a client component.
  2. Create `app/register/LoginForm.tsx`: email + password fields styled like `RegisterForm`, calling `supabase.auth.signInWithPassword()` via the existing browser client (`lib/supabase/client.ts`).
  3. On success, `router.push('/profile')`; on failure, show one generic message ("Invalid email or password").
  4. Match `RegisterForm`'s accessibility pattern (labeled inputs, `aria-invalid`/`aria-describedby` where relevant, submit button disabled while pending).
- **Acceptance:** from `/register`, switching to "Log in" and submitting valid credentials for an existing teacher redirects to `/profile`; a wrong password shows the generic error without an unhandled rejection or crash.
- **Depends on:** none (independent diff from Task 1, though it's what makes Task 1's link meaningful for existing teachers).
- **Status:** done
- **Completed:** 2026-07-09

### 3. Sign-out control on `/profile`
- **Goal:** Give a logged-in teacher a way to end their session, since Task 1 now surfaces a logged-in home state with no way out of it otherwise.
- **Steps:**
  1. Add a small client component (e.g. `app/profile/SignOutButton.tsx`) calling `supabase.auth.signOut()` via the browser client.
  2. On success, `router.push('/')`.
  3. Render it in `app/profile/page.tsx` only in the branch where `user` is present.
- **Acceptance:** from `/profile` while logged in, clicking "Sign out" returns to `/` and the home page again shows "Sign in / Sign up".
- **Depends on:** none directly, but pairs with Task 1's logged-in branch (reviewable independently, but landing all three completes the loop).
- **Status:** done
- **Completed:** 2026-07-09

## Open questions
BLOCKS-EXECUTION:
- None — design was approved inline (see Assumptions); no unresolved decisions block starting Task 1.

INFORMATIONAL:
- If Supabase email confirmation is enabled on the project (flagged as an open risk in `plans/teacher-registration.md`), a freshly registered user may not have an active session immediately — this doesn't affect Task 2's login path for already-confirmed users, only the moment right after signup, which is unchanged existing behavior.

## Risks
- **Generic error message hides real cause** (e.g. unconfirmed email vs. wrong password) — acceptable per the design decision (avoid user enumeration), but flag if it causes confusing support requests. Mitigation: none needed now; revisit copy later if it's a problem.
- **Styling drift** between `LoginForm` and `RegisterForm` if built independently. Mitigation: copy `RegisterForm`'s input/button classNames directly rather than re-deriving them.
- **Session not yet visible after client-side `signInWithPassword`** when `router.push('/profile')` fires, if the cookie write races the navigation. Mitigation: this exact pattern (client-side Supabase call → `router.push`) is already used and working in `RegisterForm.tsx`, so it's a proven approach in this codebase, not new risk.

## Definition of done
- Home page shows a session-aware entry point: "Sign in / Sign up" → `/register` when logged out, "My profile" → `/profile` when logged in.
- `/register` lets a visitor toggle between "Sign up" (existing) and "Log in" (new); both land on `/profile` on success.
- `/profile` has a working "Sign out" control that returns to the logged-out home state.
- No new server routes added; login and sign-out go through the existing Supabase browser client directly.
