# Plan: Teacher registration

Date: 2026-07-08
Status: draft

## Summary
Let a prospective teacher create an account and a minimal public profile via a `/register` page. The form posts to a `POST /v1/register` route handler, which validates input with zod and calls a Supabase-backed teacher repository: it creates a Supabase Auth user (email + password) and a matching row in the existing `teachers` table. Email confirmation is treated as disabled for this assessment, so the flow completes in one step with no confirmation callback. "Done" means: a real submission against a real Supabase project produces an authenticated user + a `teachers` row, with validation and duplicate-email errors surfaced cleanly in the UI. Full profile fields (bio, credentials, instruments, availability) are explicitly deferred to the existing `PATCH /v1/teachers` endpoint, not part of this feature.

## Assumptions
- The `teachers` table already exists in Supabase (per your confirmation) with at least: `id` (uuid, equal to the `auth.users` id), `name` (text), `hourly_price` (numeric, nullable). ⚠️ Not verified against the live schema — Task 1 should confirm actual column names/types before writing the insert, and adjust if they differ.
- RLS on `teachers` permits an authenticated user to insert a row where `id = auth.uid()`. ⚠️ Not verified — if missing, the insert in Task 1/2 will fail at runtime with a Postgres permission error, which the route handler should surface as a 500 (see Task 2).
- Supabase project's "Matchspace Music Test Assessment" auth setting will be turned off by you (dashboard config, not code) so `auth.signUp()` returns an active session synchronously. ⚠️ This is an environment prerequisite, not a coding task — flagged again in Open questions.
- Password minimum length follows Supabase's default (6 characters); no custom password policy requested.
- Registration form fields: `name`, `email`, `password`, optional `hourlyPrice`. Everything else from the spec's profile list (bio, instruments, credentials, availability) is filled in later via `PATCH /v1/teachers`, per your answer.
- No dashboard/profile page exists yet to redirect to after a successful registration — Task 3 shows an inline success state rather than redirecting, since there's nowhere meaningful to send the user yet.
- The insert happens server-side inside the route handler, using a cookie-based Supabase server client (`@supabase/ssr`) so the session established by `signUp` is what performs the `teachers` insert — keeping RLS meaningful instead of using the service-role key.
- Vitest is not yet set up in `ms-next-app` (confirmed via `package.json`) — Task 1 bootstraps it as this repo's first test harness, since Task 1's own acceptance criteria need a unit test.
- ⚠️ POST-HOC (Task 1): the sandbox's permission system denies all read access to `ms-next-app/.env` (both the `Read` tool and any `Bash` command referencing that path were blocked, even non-content commands like `wc -l`) — could not confirm the actual Supabase env var names in this run. Used the documented fallback `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `lib/supabase/env.ts`. `getSupabaseUrl()`/`getSupabasePublishableKey()` throw a clear error naming the missing var if they don't match what's actually in `.env` — verify these two names against the real file (outside this sandbox) before Task 2/3's manual end-to-end test, and adjust `lib/supabase/env.ts` if they differ.
- ⚠️ POST-HOC (Task 2): the sandbox also denies starting `npm run dev` / any long-running server process (permission for the tool use was rejected), so the manual `curl -X POST localhost:3000/v1/register` acceptance check could not be run in this environment. The route handler (`app/v1/register/route.ts`) was verified via `npm run test`, `tsc --noEmit`, and `eslint` only — the live curl check (201 on valid body, 409 on duplicate email) is deferred to you running it locally or in Task 3's manual end-to-end pass, once real Supabase env vars are confirmed.
- ⚠️ POST-HOC (Task 3): built `app/register/page.tsx` (server component wrapper) + `app/register/RegisterForm.tsx` (client component, plain `fetch` + `useState`, per the "implementer's call" note in Steps — chose `fetch`+local state over `useActionState` since the endpoint is a fixed REST route, not a co-located server action). Client-side validation reuses `registerSchema.safeParse` directly (no round-trip on obvious errors); `hourlyPrice` is only added to the payload when the field is non-empty, so omitting it doesn't trip the schema's `.optional()`. Same sandbox restriction as Tasks 1-2: `npm run dev`/`next build` and reading `.env` are unavailable here, so the actual manual acceptance test (real Supabase project: submit form → auth user + `teachers` row; duplicate email → 409 message; invalid email/short password → inline errors pre-network) could not be run. Verified instead via `tsc --noEmit` (pass), `eslint app/register` (pass, no warnings), and `npx vitest run` (13/13 existing tests still pass — no new tests added for this task since Task 3's Steps don't call for component tests and no component-testing library, e.g. React Testing Library, is installed; installing one wasn't in the Steps, so it was left out per "don't install new deps unless explicitly required"). Full manual end-to-end verification remains the user's responsibility on their local machine, once the "Matchspace Music Test Assessment" auth-confirmation setting and real `.env` values are confirmed per the earlier assumptions/risks.

## Tasks

### 1. Supabase clients + teacher repository (port/adapter) + Vitest harness
- **Goal:** Establish the data-access layer for registration — Supabase server/browser clients, a `TeacherRepository` port, and a `SupabaseTeacherRepository` adapter implementing `register(input): Teacher`. Bootstrap Vitest as the project's first unit-test harness.
- **Steps:**
  1. Install `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `vitest` (+ minimal config); add a `test` script to `package.json` and confirm it runs.
  2. Add `lib/supabase/server.ts` (cookie-based server client via `@supabase/ssr`) and `lib/supabase/client.ts` (browser client).
  3. Define the `Teacher` domain type and a `TeacherRepository` port (`lib/teachers/repository.ts`) with `register(input: RegisterTeacherInput): Promise<Teacher>`.
  4. Implement `SupabaseTeacherRepository`: calls `supabase.auth.signUp({ email, password })`, then inserts `{ id: user.id, name, hourly_price }` into `teachers`. Map a duplicate-email response from `signUp` and a unique-violation from the insert to a typed `DuplicateEmailError`; map other failures to a generic `RepositoryError`.
  5. Unit test the adapter against a mocked Supabase client: verifies `signUp` is called with the right args, `insert` is called with the right shape, and both known error paths map to `DuplicateEmailError`.
- **Acceptance:** `npm run test` passes (including the new adapter test); `tsc --noEmit` passes; the adapter has no import from `app/` (port/adapter boundary holds).
- **Depends on:** none.
- **Status:** done
- **Completed:** 2026-07-08

### 2. `POST /v1/register` route handler
- **Goal:** Expose the spec's `POST /v1/register` endpoint — validates input, calls the repository, returns the created teacher or a mapped error.
- **Steps:**
  1. Define a zod schema (`lib/teachers/register-schema.ts`, shared with Task 3) for `{ name, email, password, hourlyPrice? }` with sensible constraints (non-empty name, valid email, 6+ char password, positive `hourlyPrice`).
  2. Create `app/v1/register/route.ts` with a `POST` handler: parse + validate the body (400 + field errors on failure), call `SupabaseTeacherRepository.register`, return 201 with the created teacher (never echo `password`).
  3. Map `DuplicateEmailError` → 409, `RepositoryError`/unexpected → 500 with a generic message (no internals/stack leaked).
  4. Unit test the zod schema directly: valid payload, missing/empty name, invalid email, short password, negative `hourlyPrice`.
- **Acceptance:** `npm run test` covers the schema edge cases and passes; a manual `curl -X POST localhost:3000/v1/register` with a valid body returns 201 + teacher, and with a duplicate email returns 409.
- **Depends on:** Task 1.
- **Status:** done
- **Completed:** 2026-07-08

### 3. Registration page + form
- **Goal:** Public `/register` page where a prospective teacher submits name, email, password, and optional hourly price, and gets a clear success or error outcome.
- **Steps:**
  1. Create `app/register/page.tsx` with a client form component (controlled inputs; `useActionState` or plain `fetch` + local state — implementer's call).
  2. Validate client-side using the schema shared from Task 2 before submit, to avoid a round-trip for obvious errors.
  3. On submit: `fetch('/v1/register', { method: 'POST', body })`. Handle 201 (inline success message — no redirect, see Assumptions), 400 (inline per-field errors), 409 (duplicate-email message), other errors (generic failure message).
  4. Basic accessibility: labeled inputs, keyboard-submittable form, submit button disabled while pending.
- **Acceptance:** manually submitting the form against a real Supabase project creates an auth user + `teachers` row and shows the success state; a duplicate email shows the 409 message; an invalid email/short password shows inline errors before any network call.
- **Depends on:** Task 2.
- **Status:** done (manual end-to-end acceptance deferred — see Assumptions)
- **Completed:** 2026-07-08

## Open questions
BLOCKS-EXECUTION:
- None — you've resolved auth method, form scope, and confirmation handling. Task 1 will surface a schema mismatch (if any) as a blocked run rather than guessing.

INFORMATIONAL:
- Confirm the Supabase project's "Matchspace Music Test Assessment" setting is actually disabled before testing Task 3 end-to-end — if it's still on, `signUp()` won't return an active session and the insert-with-session approach in Task 1 will need a fallback (e.g., service-role insert) instead.
- Confirm the real `teachers` table column names (`hourly_price` vs `hourlyPrice`/`price_per_hour`, etc.) before or during Task 1 — the adapter's column mapping is a guess based on the spec's field names.

## Risks
- **Schema mismatch**: assumed column names may not match the real table → adapter insert fails. Mitigation: verify actual schema at the start of Task 1 (Supabase dashboard or `supabase gen types`) before writing the insert.
- **RLS blocks the insert**: if no policy allows `auth.uid() = id` inserts on `teachers`, every registration will 500. Mitigation: Task 1's adapter test won't catch this (it's mocked) — the first real manual test in Task 3 will; if it fails, check RLS policies before assuming a code bug.
- **Email confirmation still enabled**: if not disabled in the Supabase dashboard, `signUp()` returns a user without a session, breaking the "insert via the caller's session" design. Mitigation: confirm the dashboard setting before Task 3's manual verification; fall back to a service-role insert in Task 1 if you'd rather not change that project setting.

## Definition of done
- A teacher can visit `/register`, submit name/email/password(/hourly price), and end up with both a Supabase Auth user and a `teachers` row.
- `POST /v1/register` validates input and returns 201 + created teacher (no password) on success, 400 on validation failure, 409 on duplicate email.
- `npm run test` (Vitest) passes, covering the zod schema edge cases and the adapter's request-shaping/error-mapping logic.
- Duplicate-email and invalid-input submissions both produce a clear, non-crashing state on `/register` — no unhandled promise rejections, no raw error objects shown to the user.
- No password or service-role secret ever appears in a response body or a log line.
