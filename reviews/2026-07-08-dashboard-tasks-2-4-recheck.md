# Review: Dashboard plan — Tasks 2-4 re-review (fixes for prior BLOCK)

Date: 2026-07-08
Reviewer: independent senior full-stack review
Target: unstaged working-tree diff, worktree `dashboard-task-1` (re-review of tasks 2, 3, 4 of plans/dashboard.md after fixes to reviews/2026-07-08-dashboard-tasks-2-4.md)
Base: HEAD (6499a54, task 1's `list()`/`getById()` merged)
Head: working tree (unstaged + untracked)
Files changed: 9 (4 modified, 5 new)
Lines: +405 / -62

## Verdict
APPROVE-WITH-COMMENTS

All three items from the prior BLOCK are correctly fixed and verified against the actual code, not just the executor's claim; nothing new rises to blocker level, but one small hygiene gap is worth a follow-up.

## Summary
This diff is a targeted fix-up of the prior review's two blockers and one should-fix: (1) `SupabaseTeacherRepository`'s `adminClient` constructor param is now optional, `compensateOrphanedAuthUser` guards on its absence and logs instead of throwing, and every read call site (`app/page.tsx`, `app/teachers/[id]/page.tsx`, `GET /v1/teachers`, `GET /v1/teachers/{id}`) now constructs the repository with only the session-scoped client — no `createAdminClient()` call anywhere on the read path; (2) the teacher detail page now renders `teacher.location` under a "Lesson location" `dt`/`dd`, closing the spec-required field gap; (3) a root `app/error.tsx` client-component boundary was added, catching render/fetch failures on both public pages with a friendly retry UI. I verified each fix by reading the full files (not just the diff hunks), confirmed `tsc --noEmit`, `vitest run` (39/39 passing), and `eslint` are all clean, and re-checked that `register()`'s admin-client-based compensation path (`app/v1/register/route.ts`) is untouched and still passes `createAdminClient()` correctly. No new scope creep, no new security or correctness issues found. One minor gap: the new "no admin client" defensive branch in `compensateOrphanedAuthUser` has no test coverage.

## Findings

### 🔴 Blockers
None.

### ⚠️ Should fix
None load-bearing. See nit below for the one gap worth closing before this is fully "done."

### 💭 Nits
- [ ] **lib/teachers/supabase-repository.ts:150-159** — the new `if (!this.adminClient)` guard in `compensateOrphanedAuthUser` (added to make `adminClient` safely optional) has no corresponding test in `lib/teachers/supabase-repository.test.ts`. It's a defensive branch that should never fire in practice (only `register()` calls this method, and it always passes an `adminClient`), so this is low priority, but a one-line test ("logs and returns without throwing when adminClient is undefined") would make the contract explicit and pin the behavior. `npm run test` currently proves it can't crash `register()`'s other test cases, but not this exact branch.
- [ ] **app/page.tsx:40-42** and **app/teachers/[id]/page.tsx:26-29** — the `instruments.length > 0 ? join(", ") : fallback` ternary duplication flagged in the prior review is still present (carried over, not introduced by this fix, not required to fix now). Still worth a shared `formatInstruments()` helper whenever either page is touched next.

### 💡 Suggestions
- [ ] Consider a `loading.tsx` for `/` and `/teachers/[id]` (carried over from prior review, still out of scope for this pass).

## Verification of prior findings

- **Admin-client-on-read-path (prior 🔴 #1)** — FIXED. `lib/teachers/supabase-repository.ts:53` makes `adminClient` optional; `list()` (line 121) and `getById()` (line 131) never reference `this.adminClient`. `app/page.tsx:8`, `app/teachers/[id]/page.tsx:18`, `app/v1/teachers/route.ts:12`, and `app/v1/teachers/[id]/route.ts:14` all call `new SupabaseTeacherRepository(supabase)` with a single argument — `createAdminClient()` is not imported or called anywhere in these four files. Confirmed `app/v1/register/route.ts:30-31` and the `PATCH /v1/teachers` handler in `app/v1/teachers/route.ts` (pre-existing, out of this diff's scope) still correctly construct and pass `createAdminClient()` for the write paths that need compensation. The fix is exactly what was asked for, no regressions.
- **Missing `location` field (prior 🔴 #2)** — FIXED. `app/teachers/[id]/page.tsx:99-106` renders a "Lesson location" `dt`/`dd` pair using the same `teacher.location || NOT_PROVIDED` pattern as `bio`/`education`/`credentials`. Placed adjacent to "Online availability," matching the prior review's suggested placement.
- **No error boundary around Server Component data fetches (prior ⚠️)** — FIXED. `app/error.tsx` is a new root-level `"use client"` error boundary with a friendly message and a `reset()` retry button, which will catch thrown `RepositoryError`s from `app/page.tsx` and `app/teachers/[id]/page.tsx` (both render directly under the root segment, no nested `error.tsx` shadowing it).

## Test coverage
- `app/v1/teachers/route.test.ts` and `app/v1/teachers/[id]/route.test.ts` (pre-existing from the prior pass, unchanged in this fix) still cover found/not-found/empty-list/repository-error branches; re-ran and confirmed passing (39/39 total suite).
- No test exercises the new `compensateOrphanedAuthUser` "no adminClient" branch — see nit above.
- No test for `app/page.tsx` / `app/teachers/[id]/page.tsx` rendering the `location` field — acceptable per `CLAUDE.md` conventions (UI rendering isn't the stated testing bar), but note this means the fix was verified here by direct code read, not by an automated regression guard. If `location` regresses again, nothing will catch it.
- `npx tsc --noEmit`, `npx eslint` on all changed files, and `npx vitest run` all pass clean.

## Convention drift
None found — matches the codebase's existing error-handling, logging, and Tailwind patterns.

## Out-of-scope changes
- `plans/dashboard.md` — status/completion-date bookkeeping only for tasks 2-4, consistent with the plan's own record-keeping convention. Not a concern.

## Plan critique
None beyond what the prior review already noted (Task 4's field list omitting `location`, and the plan not spelling out which client each read call site needs). Both gaps are now closed in code; no new plan-level issue surfaced in this fix-up pass.
