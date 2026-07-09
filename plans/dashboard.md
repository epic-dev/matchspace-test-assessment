# Plan: Dashboard (public teacher list + detail pages)

Date: 2026-07-08
Status: draft

## Summary
Turn the home page (`/`) into the platform's public dashboard: a list of all registered teachers, showing each teacher's name and the instrument(s) they teach. Clicking a teacher's name navigates to a `/teachers/[id]` detail page showing their full public profile. This closes the "browse teachers" half of the spec (`GET /v1/teachers`, `GET /v1/teachers/{id}`) — no auth required, no booking/payment flow involved. "Done" means: a visitor lands on `/`, sees every registered teacher with their instruments, clicks a name, and lands on that teacher's detail page with their profile info (using placeholders for fields not yet populated at registration time).

## Assumptions
- ⚠️ POST-HOC (superseding the note below): a concurrent `profile-completion` plan landed on `main` (commits `70a9f42`..`f11ab0a`) while this plan's Task 1 was first attempted. `main` now already has `bio`, `instruments`, `education`, `credentials`, `location`, `online_availability` on `Teacher`/`TeacherRow`, a working `mapRow`, and a `parseInstruments()` helper that treats the `instruments` column as **comma-separated text**, not a native array — confirmed by that plan's own execution, not guessed. Task 1 must build on top of this existing mapping instead of re-deriving the `Teacher` type or the instruments shape from scratch; it only needs to add `list()` and `getById()` to the port/adapter, reusing `mapRow`/`parseInstruments` as-is.
- ~~The `teachers` table in Supabase already has an `instruments` column... unconfirmed~~ — resolved, see above.
- ~~`bio`, `education`, `credentials`, and `online_availability` columns either don't exist yet...~~ — resolved: these columns exist and are already read/written by `register()`/`updateOwnProfile()` on `main`.
- Server Components (`app/page.tsx`, `app/teachers/[id]/page.tsx`) call the `TeacherRepository` directly for rendering, rather than doing a self-fetch against the new `/v1/teachers` routes. The `GET /v1/teachers` and `GET /v1/teachers/{id}` route handlers are built to satisfy the spec's public API contract for external/API consumers, independent of how the pages render.
- RLS on `teachers` currently permits anonymous reads (work_log notes RLS was disabled for this table) — list/detail queries run as the anonymous/public Supabase client, no service-role key needed. If this has changed, Task 1/2's acceptance checks will surface it.
- No pagination, search, or filtering on the list for this pass — the full teacher list renders on one page. Reasonable given the assessment's scale and timeframe.
- List ordering: alphabetical by name (simplest deterministic default; not specified in the ask).
- Detail page route is `/teachers/[id]` (not specified in the ask, but matches the `/v1/teachers/{id}` API shape and is the obvious Next.js convention).

## Tasks

### 1. Repository: `list()` + `getById()`
- **Goal:** Extend the data-access layer so teacher data can be read for public display, reusing the `Teacher` type/row-mapping that already exists on `main` (see Assumptions) — without touching the write path (`register`/`updateOwnProfile`).
- **Steps:**
  1. Add `list(): Promise<Teacher[]>` and `getById(id: string): Promise<Teacher | null>` to the `TeacherRepository` port (`lib/teachers/repository.ts`). Do not change the existing `Teacher` type or add new fields — it already has everything needed.
  2. Implement both methods on `SupabaseTeacherRepository`, reusing the existing `mapRow`/`parseInstruments` helpers unchanged: `list()` selects all teacher rows ordered by name; `getById()` selects a single row by id (e.g. `.maybeSingle()`), returning `null` on not-found rather than throwing.
  3. Handle a malformed-UUID id passed to `getById()` (Postgres `22P02`) the same way as not-found — return `null`, not a thrown `RepositoryError` — since Task 2's route handler needs a clean 404 either way.
  4. Unit test both methods against a mocked Supabase client: `list()` maps multiple rows correctly and handles an empty result set; `getById()` maps a found row, returns `null` for a missing row, and returns `null` for a malformed-id error.
- **Acceptance:** `npm run test` passes including new repository tests; `tsc --noEmit` passes; `register()`/`updateOwnProfile()`'s existing behavior and tests are unaffected.
- **Depends on:** none.
- **Status:** done
- **Completed:** 2026-07-08

### 2. `GET /v1/teachers` and `GET /v1/teachers/{id}` route handlers
- **Goal:** Expose the spec's public read API for teacher listing and detail.
- **Steps:**
  1. Create `app/v1/teachers/route.ts` with a `GET` handler that calls `repository.list()` and returns 200 + JSON array.
  2. Create `app/v1/teachers/[id]/route.ts` with a `GET` handler that calls `repository.getById(id)`, returning 200 + JSON on found, 404 with a clear error body on not-found.
  3. Reuse the existing error-handling pattern from `app/v1/register/route.ts` (e.g. `RepositoryError` → 500) for unexpected failures.
  4. Unit test the route handlers' status-code/body mapping (found, not-found, empty list, repository error) with a stubbed repository.
- **Acceptance:** `npm run test` passes including new route tests; manual `curl localhost:3000/v1/teachers` and `curl localhost:3000/v1/teachers/{id}` (valid and invalid id) return the expected status/shape.
- **Depends on:** 1.
- **Status:** done
- **Completed:** 2026-07-08

### 3. Home page as public teacher list
- **Goal:** Replace the default `create-next-app` home page with the public dashboard: every teacher's name and instruments, name linking to their detail page.
- **Steps:**
  1. Rewrite `app/page.tsx` as an async Server Component that calls `repository.list()` directly and renders a simple list/grid: teacher name (as a `next/link` to `/teachers/{id}`) plus their instruments.
  2. Add a friendly empty state ("No teachers yet") for when the list is empty — must not crash.
  3. Keep styling minimal and consistent with the existing Tailwind setup already in the repo; no new UI dependencies.
- **Acceptance:** loading `/` in the browser against a real Supabase project shows all registered teachers with instruments; clicking a name navigates to `/teachers/{id}`; an empty database renders the empty state instead of an error.
- **Depends on:** 1.
- **Status:** done
- **Completed:** 2026-07-08

### 4. Teacher detail page
- **Goal:** Public `/teachers/[id]` page showing a teacher's full profile, with placeholders for fields not yet populated.
- **Steps:**
  1. Create `app/teachers/[id]/page.tsx` as an async Server Component that calls `repository.getById(id)`.
  2. Call Next.js `notFound()` (rendering the framework 404) when the teacher doesn't exist.
  3. Render the full profile layout: name, instruments, bio, education/credentials, online availability, hourly price — each showing a clear placeholder ("Not provided yet" or similar) when the underlying value is `null`/empty, rather than blank space.
  4. Keep styling minimal and consistent with the existing Tailwind setup; no new UI dependencies.
- **Acceptance:** visiting `/teachers/{valid-id}` shows the teacher's populated fields plus placeholders for empty ones; visiting `/teachers/{invalid-id}` renders a 404.
- **Depends on:** 1.
- **Status:** done
- **Completed:** 2026-07-08

## Open questions
BLOCKS-EXECUTION:
- Confirm the live `teachers` table's actual column names/types for `instruments` (and whether `bio`, `education`, `credentials`, `online_availability` exist at all yet) before Task 1 writes the row mapping — this plan assumes they exist per your answer but the exact shape is unverified in-repo.

INFORMATIONAL:
- Confirm `/teachers/[id]` as the detail route path is acceptable (not specified in the original ask).
- Confirm alphabetical-by-name ordering is fine for the list (no ordering was specified).

## Risks
- **Live schema mismatch**: assumed column names/types for `instruments` and other profile fields may not match reality → Task 1's select/mapping breaks or silently returns wrong data. Mitigation: verify actual schema before writing the mapping (Task 1, step 1).
- **RLS blocks anonymous reads**: if `teachers` RLS has been re-enabled without a public-select policy since the work_log note, list/detail queries will fail or return nothing. Mitigation: confirm RLS state before Task 2's manual acceptance check; this is a dashboard-config fix, not a code fix.
- **Empty database**: with no teachers registered, the home page must show a clear empty state, not crash or show a blank page. Mitigation: explicit empty-state handling in Task 3, step 2.
- **Missing profile data everywhere**: since most profile fields aren't collected at registration yet, every detail page may look mostly-placeholder for a while. Mitigation: accepted for this pass per your answer; revisit once `PATCH /v1/teachers` or a fuller registration form exists.

## Definition of done
- `/` is a public route listing every registered teacher's name and instruments, with a working empty state.
- Clicking a teacher's name on `/` navigates to that teacher's `/teachers/{id}` detail page.
- The detail page shows the full profile layout (name, instruments, bio, education/credentials, online availability, hourly price) with clear placeholders for unpopulated fields, and 404s for an unknown id.
- `GET /v1/teachers` and `GET /v1/teachers/{id}` route handlers exist, matching the spec's endpoints, with correct status codes for found/not-found/empty/error cases.
- `npm run test` passes, including new repository and route-handler tests.
- No teacher email, password, or service-role secret ever appears in list/detail responses.
