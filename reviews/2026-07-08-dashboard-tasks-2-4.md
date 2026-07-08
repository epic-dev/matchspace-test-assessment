# Review: Dashboard plan — Tasks 2-4 (public teacher list API + pages)

Date: 2026-07-08
Reviewer: independent senior full-stack review
Target: tasks 2, 3, 4 of plans/dashboard.md (unstaged working-tree diff, worktree `dashboard-task-1`)
Base: HEAD (181373c, includes task 1's merged `list()`/`getById()`)
Head: working tree (unstaged + untracked)
Files changed: 7 (3 modified, 4 new)
Lines: +349 / -58

## Verdict
BLOCK

Two real defects: the public read paths are wired to require a service-role secret they never use (breaking the crafted error contract and contradicting the plan's own stated assumption), and the teacher detail page silently drops a real, user-editable profile field (`location`) that the task's own goal ("full profile") requires.

## Summary
This diff exposes `GET /v1/teachers` and `GET /v1/teachers/{id}` route handlers, rewrites the home page into a public teacher list, and adds a `/teachers/[id]` detail page. The route/page code is clean, `tsc --noEmit` passes, and the four new/changed test files cover the route handlers' found/not-found/empty/error branches well. However, every new read path (`app/page.tsx`, `app/teachers/[id]/page.tsx`, `GET /v1/teachers`) unconditionally constructs a service-role Supabase client it never uses, which both violates the plan's explicit assumption ("no service-role key needed" for reads) and, in a misconfigured environment, would crash the endpoint before the route's own try/catch ever runs. Separately, the teacher detail page renders every profile field except `location` — a field that's collected via `/profile`, part of `PATCH /v1/teachers`, and directly maps to the spec's "lesson location" requirement — so a teacher who fills it in will never see it appear on their own public profile.

## Findings

### 🔴 Blockers

- [ ] **ms-next-app/app/page.tsx:8-9**, **ms-next-app/app/teachers/[id]/page.tsx:18-19**, **ms-next-app/app/v1/teachers/route.ts:11** — every new *public, unauthenticated, read-only* path calls `createAdminClient()` and passes it into `SupabaseTeacherRepository`, even though `list()`/`getById()` never touch `this.adminClient` (see `lib/teachers/supabase-repository.ts:119-146`). `createAdminClient()` → `getSupabaseSecretKey()` (`lib/supabase/env.ts:22-24`) throws synchronously if `SUPABASE_SECRET_KEY` isn't set. In `app/v1/teachers/route.ts` that call sits *outside* the `try`/`catch` (lines 10-13), so a missing/misconfigured secret in any environment (a preview deploy, a locked-down runtime, a future secret-rotation gap) doesn't produce the route's crafted `{ error: "Failed to list teachers" }` 500 — it produces an unhandled exception and Next's generic framework error page, on the single most public endpoint in the spec. This also directly contradicts the plan's own written assumption: "list/detail queries run as the anonymous/public Supabase client, no service-role key needed" (plans/dashboard.md, Assumptions). Public reads should never require a privileged, service-role credential to exist for no functional reason. **Fix:** make `adminClient` optional on `SupabaseTeacherRepository`'s constructor (it's only used by `register()`'s compensation path) and stop constructing it in `page.tsx`, `teachers/[id]/page.tsx`, and `GET /v1/teachers` — pass `undefined`/omit it, or build a lighter read-only client factory for these call sites.

- [ ] **ms-next-app/app/teachers/[id]/page.tsx:28-106** — the detail page renders `instruments`, `bio`, `education`, `credentials`, `onlineAvailability`, and `hourlyPrice`, but never renders `teacher.location`. `location` is a real field on the `Teacher` domain type (`lib/teachers/repository.ts:9`), it's collected via the "Lesson location" input on `/profile` (`app/profile/ProfileForm.tsx:246-275`, placeholder: "e.g. Downtown studio, or leave blank if online-only"), it's part of `updateTeacherSchema` and `PATCH /v1/teachers`, and it directly maps to the spec's "lesson location or online availability" requirement (CLAUDE.md → Assessment spec). A teacher who fills in their studio address via `/profile` will never see it on their own public profile page — this fails Task 4's own Goal ("Public `/teachers/[id]` page showing a teacher's full profile") and the plan's Definition of done ("The detail page shows the full profile layout"). **Fix:** add a `Location` `<dt>`/`<dd>` pair (with the same `NOT_PROVIDED` placeholder pattern used for the other fields), likely paired with or adjacent to the online-availability row since they're the two halves of the same spec bullet.

### ⚠️ Should fix

- [ ] **ms-next-app/app/page.tsx:11** and **ms-next-app/app/teachers/[id]/page.tsx:22** — `repository.list()` / `repository.getById()` are called with no `try`/`catch` and there's no `app/error.tsx` in the tree. A transient Supabase failure (the exact case `RepositoryError` exists to model) surfaces as Next's default unstyled error boundary instead of a friendly message, on the app's two public-facing pages. Route dimension D explicitly calls out "no unhandled reject in render paths." **Fix:** add a minimal `app/error.tsx` (and optionally `app/teachers/[id]/error.tsx`) with a friendly "Something went wrong, try again" message — a few lines, consistent with the empty-state handling already done for the no-teachers case.

### 💭 Nits

- [ ] **ms-next-app/app/page.tsx:31-34** and **ms-next-app/app/teachers/[id]/page.tsx:28-31** — the `instruments.length > 0 ? join(", ") : fallback` ternary is duplicated verbatim across both pages. Minor DRY violation; a shared `formatInstruments(teacher.instruments)` helper in `lib/teachers/` would remove the duplication and give both pages one place to change if the separator/fallback ever changes.
- [ ] **ms-next-app/app/teachers/[id]/page.tsx:36-41** — `onlineAvailabilityText`'s triple-nested ternary is correct (null vs. true vs. false are all handled distinctly) but reads awkwardly. Consider a small `switch`/lookup for readability; not load-bearing.

### 💡 Suggestions

- [ ] Consider a `loading.tsx` for `/` and `/teachers/[id]` so the data fetch shows a skeleton instead of a blank tab during navigation — out of scope for this same-day pass, worth a follow-up once there's real data volume.

## Test coverage
- `app/v1/teachers/route.test.ts` and `app/v1/teachers/[id]/route.test.ts` cover found/not-found/empty-list/repository-error branches for both route handlers with a stubbed repository — this matches Task 2's acceptance criterion and is solid, focused unit coverage.
- No tests exist for `app/page.tsx` or `app/teachers/[id]/page.tsx` (the Server Components). Per `CLAUDE.md → Conventions` ("light unit tests... focused on core business logic"), UI rendering isn't the stated bar, so this is acceptable — but note neither page's tests would have caught the missing `location` field or the admin-client coupling above; both were only found by reading the full file against the domain type and the sibling form.
- Nothing exercises the `createAdminClient()`-throws-outside-try/catch path identified above — reasonably hard to unit test as structured today, which is itself a signal that the dependency shouldn't be there. Verify the fix by running `npm run test` after making `adminClient` optional, and manually confirm `curl localhost:3000/v1/teachers` still 200s with `SUPABASE_SECRET_KEY` unset.

## Convention drift
None found — file structure, error-handling pattern (typed logger, generic 500 body), and Tailwind styling match the rest of the codebase.

## Out-of-scope changes
- `plans/dashboard.md` — only status/completion-date bookkeeping for tasks 2-4, matches the plan's own record-keeping convention. Not a concern.

## Plan critique
Task 4, Step 3's field list ("name, instruments, bio, education/credentials, online availability, hourly price") omits `location` even though `location` was already a real column on `Teacher` and already collected via `/profile` at the time this plan was written (per the plan's own Assumptions section, which explicitly says these columns "exist and are already read/written by `register()`/`updateOwnProfile()` on `main`"). The plan should have listed all `Teacher` fields as the basis for "full profile," not a hand-typed subset — this is exactly the kind of gap independent review exists to catch regardless of whether the plan called it out. Separately, the plan's Assumptions section states "no service-role key needed" for reads, but no task step told the executor how to instantiate `SupabaseTeacherRepository` for the new read call sites — leaving room for a copy-paste from the write-path pattern (`createClient()` + `createAdminClient()`) that directly contradicts that assumption. A one-line task step ("read call sites only need `createClient()`, not `createAdminClient()`") would have closed this gap.
