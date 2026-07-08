# Plan: Profile completion after registration

Date: 2026-07-08
Status: draft

## Summary
Today `POST /v1/register` collects only `name`, `email`, `password`, and optional `hourlyPrice`, then shows an inline "you're registered" message with no way to add the rest of the profile. This feature closes that gap: on successful registration, the browser redirects the new teacher to `/profile`, a mandatory completion step where they fill in the remaining spec fields — bio, instruments, education/credentials, and lesson location/online availability. Submitting calls a new `PATCH /v1/teachers` endpoint (required by the spec, not yet built), which updates the *currently authenticated* teacher's row via their Supabase session — no teacher id in the request. "Done" means: a teacher who just registered lands on `/profile`, cannot proceed without submitting the remaining fields, and a real submission against a real Supabase project updates their `teachers` row.

## Assumptions
- ⚠️ Not verified against the live schema: the `teachers` table needs columns for `bio`, `instruments`, `education`, `credentials`, `location` (or similar for lesson location), and `is_online`/`online_availability`. Task 1 must confirm actual column names/types against the live Supabase table before writing the update, and add any missing columns (via Supabase dashboard — schema changes are config, not code) before the adapter code is written against them.
- `instruments` is stored as a single column (e.g. Postgres text array or comma-separated text) rather than a normalized join table — per `work_log.md`'s "out of scope: instruments table" note. Task 1 should use whatever array-capable column type is simplest given the current table, not introduce a new table.
- "Mandatory" (per your answer) means: the `/profile` page has no skip/"finish later" control, and the form must pass validation before it submits successfully. It does **not** mean other parts of the app (e.g. a future `/teachers` public listing) block on profile completeness — enforcing that elsewhere is out of scope for this plan.
- Auth guard on `/profile`: relies on the Supabase session cookie already set by `signUp()` during registration (per the existing registration plan's assumption that email confirmation is disabled). If a signed-out visitor loads `/profile` directly, the page shows a simple "please register first" message and a link to `/register` — no full login page is built as part of this plan (none exists yet in the repo).
- `PATCH /v1/teachers` accepts a partial body (all fields optional, per spec) but this plan's `/profile` form always submits the full remaining-field set in one request, since it's the mandatory first-completion step, not a partial edit — the endpoint itself still validates each field independently so it's reusable later for partial edits.
- No redirect target beyond `/profile` is needed after a successful `PATCH` for this plan — a simple inline success state (mirroring the existing registration form's pattern) is sufficient. Where the teacher goes *after* completing their profile (e.g. a dashboard) is out of scope — flagged as an open question below.
- ⚠️ POST-HOC (Task 1): the sandbox again denies `Read`/`Bash` access to `ms-next-app/.env`, and no Supabase CLI/MCP link is available in this environment, so the live `teachers` table schema could not be confirmed as the plan's Step 1 asks (this remains a manual/dashboard step for you to do outside this sandbox, same limitation noted in `teacher-registration.md`). Proceeded on the "simplest shape that fits existing conventions" fallback the plan authorized, and picked concrete column names/types that Task 2+ should treat as authoritative unless you tell the executor otherwise: `bio text`, `instruments text` (comma-separated, per your answer), `education text`, `credentials text`, `location text`, `online_availability boolean`, all nullable — matching the existing `hourly_price` snake_case convention. Domain-level, `Teacher.instruments` is `string[] | null` (the adapter joins/splits the comma-separated column at the boundary) and `Teacher.location` / `Teacher.onlineAvailability` are two separate fields (not one combined field), matching Task 4's UI plan ("location text + an online-availability checkbox") even though Task 2's own field-list example only names `onlineAvailability` — Task 2's executor should add `location` to its zod schema/route to stay consistent with this Task 1 shape.
- ⚠️ POST-HOC (Task 1): a "no rows updated" outcome from `.update(...).eq("id", userId).select().single()` is detected via PostgREST's `PGRST116` ("no rows found") error code and mapped to a new `TeacherNotFoundError` (added to `lib/teachers/errors.ts`), distinct from the generic `RepositoryError`.
- ⚠️ POST-HOC (Task 1): the existing `SupabaseTeacherRepository.register` adapter test's exact-equality assertions on the returned `Teacher` were updated to include the new nullable fields (all `null` for a fresh registration), since widening the `Teacher` type is a breaking change to that pre-existing test's `toEqual` expectations — no behavior of `register` itself changed.
- ⚠️ POST-HOC (Task 2): per explicit mid-task instruction, `updateTeacherSchema` (`lib/teachers/update-schema.ts`) drops the business-rule constraints (`min(1)` on strings, `positive()` on `hourlyPrice`) that Task 2's own Steps said should mirror `registerSchema` — every field is optional *and* unconstrained beyond its basic type/shape (string/array-of-strings/boolean/number). An empty-string `bio` or a `hourlyPrice` of `0` now validate successfully; only type mismatches (e.g. `hourlyPrice: "40"`, non-array `instruments`) are rejected. `name`'s overlap-with-`registerSchema` constraint (non-empty) was dropped too, for consistency across all fields. Route handler and tests were written against this looser shape.

## Tasks

### 1. Extend teacher domain/repository with full profile fields
- **Goal:** Widen the `Teacher` domain type, `TeacherRepository` port, and `SupabaseTeacherRepository` adapter so a teacher's full profile (bio, instruments, education, credentials, location/online availability) can be read and updated, not just created with `name`/`hourlyPrice`.
- **Steps:**
  1. Confirm the live `teachers` table schema (Supabase dashboard) for the new fields; add any missing columns there (manual/config step, not code).
  2. Update `Teacher` and add an `UpdateTeacherInput` type in `lib/teachers/repository.ts`; add an `updateOwnProfile(userId, input): Promise<Teacher>` method to the `TeacherRepository` port.
  3. Implement the method on `SupabaseTeacherRepository`: builds a partial update object from whatever fields are present, runs `.update(...).eq("id", userId).select().single()`, maps the row back to `Teacher` (extend `mapRow`/`TeacherRow`).
  4. Map a "no row updated" (teacher id not found — shouldn't happen for an authenticated caller updating their own row, but guard anyway) to a typed error; reuse `RepositoryError` for unexpected failures.
  5. Unit test the adapter method against a mocked Supabase client: verifies `.update` is called with only the provided fields, and the not-found path maps correctly.
- **Acceptance:** `npm run test` passes (including the new adapter test); `tsc --noEmit` passes; adapter still has no import from `app/`.
- **Depends on:** none (builds on existing Task 1 of the registration plan).
- **Status:** done
- **Completed:** 2026-07-08

### 2. `PATCH /v1/teachers` route handler
- **Goal:** Expose the spec's `PATCH /v1/teachers` endpoint — updates the calling teacher's own profile, identified via their Supabase session, never via an id in the body.
- **Steps:**
  1. Define a zod schema (`lib/teachers/update-schema.ts`) for the spec's `PATCH` body: `{ name?, bio?, instruments?, education?, credentials?, onlineAvailability?, hourlyPrice? }`, all optional, same field-level constraints as `registerSchema` where they overlap.
  2. Create `app/v1/teachers/route.ts` with a `PATCH` handler: read the session via the cookie-based server Supabase client, return 401 if no authenticated user; parse + validate the body (400 + field errors on failure); call `repository.updateOwnProfile(user.id, parsed.data)`.
  3. Return 200 with the updated teacher on success; map repository errors to 500 with a generic message (no internals leaked).
  4. Unit test the zod schema directly: valid partial payload, empty body (should still validate as "no-op" success per spec's all-optional fields), invalid field values.
- **Acceptance:** `npm run test` covers the schema edge cases and passes; a manual authenticated `curl -X PATCH localhost:3000/v1/teachers` updates the row and returns 200; an unauthenticated request returns 401.
- **Depends on:** Task 1.
- **Status:** done
- **Completed:** 2026-07-08

### 3. Redirect to `/profile` after successful registration
- **Goal:** Replace the registration form's inline "you're registered" success state with a redirect to `/profile`, so the new teacher lands directly on the completion step.
- **Steps:**
  1. In `RegisterForm.tsx`, on a 201 response, use Next's router (`useRouter().push("/profile")`) instead of setting local `success` state.
  2. Remove the now-unused inline success message and `success` state.
  3. Keep existing 400/409/generic-error handling on the registration form unchanged.
- **Acceptance:** manually registering redirects the browser to `/profile` immediately after a 201 response; failed registrations (400/409) still show inline errors and do not redirect.
- **Depends on:** none (independent of Tasks 1-2; can ship in parallel, but functionally only makes sense once `/profile` exists — see Task 4).

### 4. `/profile` completion page + form
- **Goal:** A page at `/profile` where a newly-registered (or returning, incomplete) teacher fills in bio, instruments, education/credentials, and lesson location/online availability, and submits via `PATCH /v1/teachers`.
- **Steps:**
  1. Create `app/profile/page.tsx` (server component): checks the Supabase session server-side; if signed out, render a "please register first" message with a link to `/register` instead of the form.
  2. Create `app/profile/ProfileForm.tsx` (client component): controlled inputs for bio, instruments (simple comma-separated text input, split into an array client-side), education/credentials, location text + an online-availability checkbox, mirroring `RegisterForm`'s existing validation/error/pending-state pattern.
  3. Client-side validate with the schema shared from Task 2 before submit; no skip control (mandatory, per your answer) — the only way off the page is a successful submit.
  4. On submit: `fetch('/v1/teachers', { method: 'PATCH', body })`; handle 200 (inline success state), 400 (inline per-field errors), 401 (redirect to `/register`), other errors (generic failure message).
  5. Basic accessibility: labeled inputs, keyboard-submittable form, submit button disabled while pending — same bar as the existing registration form.
- **Acceptance:** manually completing the form against a real Supabase project updates the `teachers` row with the new fields and shows a success state; invalid input shows inline errors before any network call; visiting `/profile` signed out shows the "please register first" state instead of the form.
- **Depends on:** Task 2 (needs a working `PATCH /v1/teachers` to submit to).

## Open questions
BLOCKS-EXECUTION:
- None — schema gaps are handled as a verify-then-adjust step inside Task 1, same pattern as the original registration plan.

INFORMATIONAL:
- Confirm actual/desired column names and types for `instruments` (array vs. text) and the location/online-availability pair before Task 1, if you already have a preference — otherwise Task 1 will pick the simplest shape that fits the existing table conventions (e.g. matching `hourly_price`'s snake_case).
  - `instruments` - comma-separated text
- Where does the teacher go *after* successfully completing `/profile`? Out of scope for this plan (Assumptions) — worth deciding before or during a later "teacher dashboard" plan, since right now the success state is a dead end with no next action.
  - for now stay at the profile page, just show notification that updates was successful
- Should `/profile` also serve as the page a teacher returns to later for ordinary profile edits (not just first-run completion), or will that be a separate page/plan? This plan builds `/profile` only for the first-run mandatory flow; reusing it for later edits may need a "skip if already complete" check that's explicitly not built here.
  - yes, the page also serves as the page a teacher returns to later profile updates

## Risks
- **Schema mismatch**: assumed column names/types for the new fields may not match the real table → adapter update fails at runtime. Mitigation: verify the live schema at the start of Task 1 before writing the update, same as the original registration plan's Task 1.
- **RLS blocks the update**: if no policy allows `auth.uid() = id` updates on `teachers`, every `PATCH` will 500. Mitigation: Task 2's manual curl check will surface this immediately; check RLS policies before assuming a code bug (RLS was disabled for `teachers` per `work_log.md`, so likely not an issue, but re-verify).
- **Mandatory flow with no login page**: a teacher who registers, closes the tab, and returns later without an active session has no way to resume completing their profile (no login page exists). Mitigation: flagged in Open questions; acceptable for this same-day pass since the spec doesn't require a login page beyond what Supabase Auth provides.
- **Dead-end success state**: with no defined "after `/profile`" destination, the completion form's success state has nothing to link to. Mitigation: ship a plain "profile complete" message for now; revisit once a dashboard/teacher-view page is planned.

## Definition of done
- Registering successfully redirects the browser to `/profile` (no more inline "you're registered" message on the registration form).
- `/profile` renders a form for bio, instruments, education/credentials, and lesson location/online availability, with no skip option.
- Submitting `/profile`'s form calls `PATCH /v1/teachers`, which updates the *authenticated* teacher's row (no id in the request) and returns the updated profile.
- `PATCH /v1/teachers` returns 401 for signed-out callers, 400 with field errors for invalid input, 200 + updated teacher on success.
- Visiting `/profile` while signed out shows a "please register first" state instead of the form, with no crash.
- `npm run test` (Vitest) passes, covering the new update-schema edge cases and the adapter's update/error-mapping logic.
