# Review: Lesson booking — Tasks 2-3 (POST /v1/booking route, booking form)

Date: 2026-07-09
Reviewer: independent senior full-stack review
Target: git diff 9df8cac..HEAD (plans/lesson-booking.md Tasks 2 and 3)
Base: 9df8cac
Head: 37b5454
Files changed: 4
Lines: +460 / -0

Note on scope: the invocation described this range as covering "Tasks 1-3."
It doesn't. `ff0276d` (Task 1: bookings data model/repository) is already an
ancestor of the merge commit `9df8cac` and is excluded from this diff —
confirmed with `git merge-base --is-ancestor ff0276d 9df8cac`. Two Stripe
commits visible in `git log --all` (`7f2bb7d`, `d03147b`) live on a sibling
worktree branch (`worktree-stripe-checkout-plan`) and are also not part of
this diff. The actual diff is Task 2 (`app/v1/booking/route.ts`) and Task 3
(`app/teachers/[id]/BookingForm.tsx`, wiring in `app/teachers/[id]/page.tsx`),
plus plan-file status updates. Task 1's files
(`lib/bookings/repository.ts`, `supabase-repository.ts`, `booking-schema.ts`,
`overlap.ts`, `errors.ts`) were read for context only, not reviewed as new
changes — but see the Blocker below, which is a bug in already-merged
Task 1 code that this diff is the first thing to actually exercise.

## Verdict
BLOCK

The booking form's default, untouched submission path creates a "pending"
booking with no location and not marked online — the one hard invariant
Task 1's schema was supposed to enforce is silently bypassed the moment a
real UI exercises it.

## Summary
Task 2 adds `POST /v1/booking`: parse → validate → look up teacher → check
conflict → create. It correctly mirrors the existing `PATCH /v1/teachers`
and `GET /v1/teachers/[id]` route conventions (error shape, generic 500 with
server-side logging, 404 handling) — verified against
`app/v1/teachers/route.ts` and `app/v1/teachers/[id]/route.ts` line-by-line.
Task 3 adds a plain, accessible, controlled-form `BookingForm` that reuses
`booking-schema.ts` client-side per the plan's stated convention (mirroring
`ProfileForm.tsx`'s `updateTextField` pattern almost exactly, including the
un-imported `React.ChangeEvent` usage, which does compile — confirmed via
`npx tsc --noEmit`). The wiring in `page.tsx` is a clean RSC→client-component
boundary crossing (serializable props only).

Top issues: (1) the form always sends `isOnline` as an explicit boolean,
which defeats `booking-schema.ts`'s `.refine()` requiring "location or
isOnline" — the default form state (blank location, unchecked toggle)
submits successfully and produces an unusable booking. (2) `POST
/v1/booking` — the one route in this diff with genuine branching business
logic (400/404/409/201/500) — has no automated test, unlike its sibling
routes `GET /v1/teachers` and `GET /v1/teachers/[id]`, both of which have a
`route.test.ts` in the same directory. (3) no validation anywhere (client or
server) rejects a `dateTime` in the past.

## Findings

### 🔴 Blockers
- [ ] **ms-next-app/app/teachers/[id]/BookingForm.tsx:75** — `payload.isOnline = values.isOnline` is set unconditionally (`true` or `false`), while `payload.location` is only set when non-blank (lines 82-84). `booking-schema.ts`'s `.refine((data) => data.location !== undefined || data.isOnline !== undefined, ...)` treats an explicit `isOnline: false` as "set," so the refine can never fail through this form. Concretely: a student who leaves the location field blank and leaves the "online" checkbox unchecked (the default state on page load, and the default for any teacher whose `onlineAvailability` isn't `true`) submits successfully and the API creates a `pending` booking with `location: null, isOnline: false` — nobody, including the teacher, knows where or how the lesson happens. This isn't an edge case; it's the default happy path. **Fix:** only include `isOnline` in the payload when it's actually `true` — e.g. `if (values.isOnline) { payload.isOnline = true; }` — so an unchecked box with a blank location leaves both keys `undefined` and the refine fires as intended, surfacing a field error the user can act on. (The underlying design smell is in `lib/bookings/booking-schema.ts:28-31`, out of range for this diff, but worth a follow-up: the refine should really be `data.location || data.isOnline === true`, not presence-based, so it isn't silently defeated the next time a boolean field is threaded through unconditionally.)

### ⚠️ Should fix
- [ ] **ms-next-app/app/v1/booking/route.ts** (whole file, no companion test) — `GET /v1/teachers` (`app/v1/teachers/route.test.ts`) and `GET /v1/teachers/[id]` (`app/v1/teachers/[id]/route.test.ts`) both have vitest route tests that mock the repository and assert status codes/response shapes. `POST /v1/booking` has the most branching logic of any route in the codebase so far (400 malformed JSON, 400 schema failure, 404 unknown teacher, 409 conflict, 201 success, 500 repo failure) and has zero automated coverage — Task 2's acceptance criteria says "manual curl cases," which don't run in CI and don't survive a refactor. `CLAUDE.md → ## Conventions` explicitly calls out "booking creation" as the kind of core business logic that should get unit tests. **Fix:** add `app/v1/booking/route.test.ts` following the exact mocking pattern in `app/v1/teachers/route.test.ts` (mock `SupabaseTeacherRepository.getById` and `SupabaseBookingRepository.hasConflict`/`create`), covering the five branches above.
- [ ] **ms-next-app/app/teachers/[id]/BookingForm.tsx:147-156** — the `datetime-local` input has no `min` and `booking-schema.ts` has no lower-bound check on `dateTime`, so a student can request (and the API will happily create) a lesson in the past. Not explicitly required by the spec, but it's a one-line guard against an obviously-wrong booking. **Fix:** add `min={new Date().toISOString().slice(0, 16)}` to the input for the client-side nudge (note `noValidate` means this alone won't block submission — pair it with a schema-level `.refine` if you want it actually enforced, or accept the client-only nudge for this pass and note the gap).

### 💭 Nits
- [ ] **ms-next-app/app/teachers/[id]/BookingForm.tsx:104-108** — on a successful submit, `success` is set to `true` and never reset if the student starts typing into the form again afterward (e.g. to book a second lesson). The stale "Booking request sent" banner stays visible alongside newly-entered values. Minor UX rough edge, not a functional bug — clear `success` in the field `onChange` handlers or on next submit attempt.
- [ ] **ms-next-app/app/teachers/[id]/BookingForm.tsx:7** — `FieldErrors` is keyed off `keyof BookingRequest`, which includes `teacherId`, but no `<input>` for `teacherId` exists to render `fieldErrors.teacherId` against. Harmless (teacherId is always a valid uuid sourced from `teacher.id`), but it's dead surface in the type — worth a comment noting it's intentionally unrenderable, or narrow the type to the fields actually rendered.

### 💡 Suggestions
- [ ] The plan's own Risks section already flags the check-then-insert race in `hasConflict`/`create` (two students can both pass the conflict check for the same slot before either insert lands). Out of scope for this pass per the plan, but a Postgres exclusion constraint on `(teacher_id, tstzrange(date_time, date_time + hours))` would close it cheaply once `bookings` gets a real migration file — worth a follow-up ticket rather than hand-waving it away indefinitely.
- [ ] `hours` has a `.positive()` lower bound but no upper bound — a student could request a 500-hour "lesson." Almost certainly harmless for a same-day MVP with no anti-abuse scope, but a sanity cap (e.g. `.max(8)`) is a one-line addition if this becomes a real complaint.

## Test coverage
- Covered: `lib/bookings/overlap.test.ts` (interval-overlap pure function) — pre-existing, not part of this diff, but the acceptance criterion it satisfies (Task 1) is real.
- Not covered: `app/v1/booking/route.ts` has no `route.test.ts` despite sibling routes (`app/v1/teachers/route.test.ts`, `app/v1/teachers/[id]/route.test.ts`) establishing the pattern for exactly this kind of route-with-branches. This is the most consequential gap — see Should-fix above.
- Not covered: `BookingForm.tsx` has no component test. Given `CLAUDE.md`'s explicit "no e2e tests" and light-unit-test scope, this is defensible to skip, but the `isOnline`/`location` refine bug above is exactly the kind of thing a single RTL test (`fireEvent.submit` with default values, assert on the resulting fetch payload or the rendered field error) would have caught before merge.
- No coverage exists (and none is planned) for the race condition in `hasConflict`/`create` — acceptable per the plan's own risk acceptance.

## Plan critique
- Task 2's acceptance criteria ("manual curl cases") is weaker than what `CLAUDE.md → ## Conventions` promises ("light unit tests... focused on core business logic (booking creation, pricing/availability rules)") and weaker than the precedent already set by the teacher-listing routes in the same repo. The plan should have specified a `route.test.ts` for Task 2 the same way it implicitly expected `overlap.test.ts` for Task 1 — instead it downgraded to manual verification for the one route with actual branching logic, and that's exactly where the missing-test gap now sits.
- Task 3's acceptance criteria was left as "I'll do it by myself" — an informal, unverifiable gate. That's a reasonable call for pure UI polish, but this task also determines what payload shape gets sent to a schema with a cross-field business invariant (`location` XOR `isOnline`) inherited from Task 1. A one-line acceptance bullet — "submitting with blank location and the online toggle off is rejected, not silently accepted" — would have caught the Blocker above before it shipped. Cross-field invariants defined in one task (schema) need an explicit acceptance check in any later task (form) that's the first real caller of that schema through a UI.
