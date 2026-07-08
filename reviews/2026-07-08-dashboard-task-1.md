# Review: Dashboard plan — Task 1 (Repository: `list()` + `getById()`)

Date: 2026-07-08
Reviewer: independent senior full-stack review
Target: task 1 of plans/dashboard.md (unstaged working-tree diff, worktree `dashboard-task-1`)
Base: HEAD (f11ab0a)
Head: working tree (unstaged)
Files changed: 4
Lines: +208 / -10

## Verdict
APPROVE

Small, correctly-scoped diff: two new read methods on the repository port/adapter, reusing the existing row-mapping unchanged, with solid test coverage for every branch and a clean `tsc --noEmit` — nothing here needs to change before merge.

## Summary
This diff adds `list()` and `getById()` to `TeacherRepository` / `SupabaseTeacherRepository` (`ms-next-app/lib/teachers/repository.ts`, `supabase-repository.ts`), plus matching unit tests. It correctly reuses the `Teacher` type and `mapRow`/`parseInstruments` helpers that already existed on `main` from a concurrent plan, rather than re-deriving them — the plan file was honestly amended to record that fact before Task 1 was re-scoped, which is exactly the right call instead of silently duplicating work. `getById()` uses `.maybeSingle()` (correct choice over `.single()`, which throws on 0 rows) and folds the Postgres "invalid UUID" error (`22P02`) into a `null` return so a malformed id 404s instead of 500ing. `list()` orders by `name` and maps an empty result set to `[]` without special-casing. No route handlers, register/updateOwnProfile behavior, or unrelated files were touched — scope matches the task exactly. I verified `npx tsc --noEmit` passes clean with the diff applied (strict mode, test files included via `**/*.ts`).

## Findings

No blockers or should-fix items found in this diff.

### 💭 Nits
- [ ] **ms-next-app/lib/teachers/supabase-repository.ts:120,132** — `list()`/`getById()` use bare `.select()` (select `*`) rather than naming the columns actually needed. It's not a leak risk here — `mapRow` whitelists fields by name, so any extra column (were one added later) is silently dropped, not exposed — but explicit column selection documents intent and avoids pulling unnecessary bytes over the wire as the table grows. Matches the existing pattern in `register()`/`updateOwnProfile()`, so this is pre-existing style, not something this diff introduced.

### 💡 Suggestions
- [ ] `Teacher.instruments` is typed `string[] | null` and `parseInstruments()` collapses an empty/blank column to `null` rather than `[]` (`supabase-repository.ts:218-225`, unchanged by this diff). Every downstream consumer of `list()`/`getById()` (Task 3/4's pages) will need `instrument ?? []` or an explicit null-check before `.map()`/`.join()`. Worth a one-line note in Task 3/4 or normalizing to `[]` at the mapping boundary so `null` never has to be re-handled at every call site. Out of scope for this task since the type predates it, but worth raising before Task 3 ships.

## Test coverage
- `SupabaseTeacherRepository.list()`: multiple rows mapped correctly (including instrument string→array parsing), empty result set → `[]`, query failure → `RepositoryError`. (`ms-next-app/lib/teachers/supabase-repository.test.ts:241-316`)
- `SupabaseTeacherRepository.getById()`: found row mapped correctly, missing row → `null`, malformed-id Postgres error (`22P02`) → `null` (not thrown), unrelated query failure → `RepositoryError`. (`ms-next-app/lib/teachers/supabase-repository.test.ts:327-387`)
- Every branch in both new methods (success, empty, not-found, malformed-input, generic-error) has a corresponding test — this is the coverage bar a senior reviewer expects for a repository adapter. Nothing missing for this task's scope.
- `register()`/`updateOwnProfile()` tests untouched and unaffected, matching the acceptance criterion that this change doesn't regress the write path.

## Convention drift
None. Naming (camelCase domain / snake_case columns), error-throwing pattern (`RepositoryError` with `cause`), and test structure (mocked Supabase client builders per method) all match the existing file's established conventions.

## Out-of-scope changes
None. The diff touches exactly `lib/teachers/repository.ts`, `lib/teachers/supabase-repository.ts`, `lib/teachers/supabase-repository.test.ts`, and `plans/dashboard.md` (status/assumption update) — all called for by Task 1 or its bookkeeping. No route handlers, pages, or unrelated files were touched (correctly deferred to Tasks 2-4).

## Plan critique
None to flag as a defect — if anything this is a good example of the plan self-correcting: Task 1 originally assumed the `instruments`/`bio`/`education`/etc. columns' existence was unconfirmed and had the executor inspect schema from scratch. A concurrent `profile-completion` plan landed those fields on `main` first; the plan was honestly amended (with a `POST-HOC` note and strikethroughs, not a silent rewrite) to redirect Task 1 to reuse that existing mapping instead of re-deriving it, which is exactly the right response to a plan being overtaken by a sibling plan's execution. No layering or granularity issue.
