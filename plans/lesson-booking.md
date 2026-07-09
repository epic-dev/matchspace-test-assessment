# Plan: Lesson booking

Date: 2026-07-08
Status: draft

## Summary
Public users can browse teachers, view a teacher's detail page, and submit a
booking request for a specific date/time. The request is rejected up front if
it conflicts with a booking the teacher already has. This plan covers the
request flow from a known teacher's detail page — date/time entry,
conflict-checked submission, and persistence — but stops at creating a
`pending` booking row. Teacher browsing/selection (a `/teachers` list page
and the `GET /v1/teachers*` endpoints) was removed from this plan on review
and is assumed to be delivered separately. Stripe checkout and
payment-triggered confirmation (`POST /v1/checkout`) are explicitly out of
scope and will be a follow-up plan. Done means: a student on a teacher's
detail page can submit a booking request without touching Supabase directly,
and a double-booked slot is rejected with a clear error instead of silently
overwriting or double allocating a teacher's time.

## Assumptions
- "Available" means *no existing booking overlapping the requested
  `[dateTime, dateTime + hours)` window for that teacher* — there is no
  teacher-defined weekly-availability entity in the data model, and this plan
  does not add one. (User-confirmed.)
- Every existing booking for a teacher counts as blocking, regardless of
  status — there's no cancellation flow yet, so there's no "ignore cancelled
  bookings" case to handle.
- `hours` defaults to 1 when omitted, per the spec's booking entity note
  (`hours (default 1)`).
- Booking rows get a `status` column defaulting to `'pending'`. Nothing in
  this plan transitions it to `'confirmed'` — that's the payment plan's job —
  but the column needs to exist now so that plan doesn't require a migration
  of its own.
- ⚠️ No `supabase/migrations` folder or SQL files exist anywhere in the repo
  (the `teachers` table itself was evidently created by hand, e.g. via the
  Supabase SQL editor or dashboard). This plan follows the same pattern: the
  `bookings` table is created by hand from the SQL documented in Task 3, not
  via a migration file in the repo. Flagged as BLOCKS-EXECUTION below in case
  that's wrong.
- No auth is required to submit a booking (matches spec: "no student account
  required").
- ⚠️ Teacher browsing/selection (`GET /v1/teachers`, `GET /v1/teachers/{id}`,
  and any `/teachers` list UI) is out of scope for this plan — removed per
  review. This plan now starts from "a teacher detail page needs a booking
  form" and assumes teacher lookup by id is available. See the
  BLOCKS-EXECUTION question below: `TeacherRepository` currently has no
  `getById`, and nothing in this plan adds it unless Task 2 does.

## Tasks

### 1. Bookings data model + repository
- **Goal:** a place to persist booking requests, plus the conflict-check
  logic as a unit-testable pure function.
- **Steps:**
  - Document. The `bookings` table exists with columns: `id, teacher_id, date_time, hours, location, is_online, student_name, student_email, message, status, created_at`.
  - Add `lib/bookings/repository.ts`: `Booking` domain type, `CreateBookingInput`, and a `BookingRepository` port with `create(input)` and `hasConflict(teacherId, dateTime, hours)`.
  - Add `lib/bookings/supabase-repository.ts` implementing the port. `hasConflict` queries existing bookings for the teacher and checks interval overlap against `[dateTime, dateTime + hours)`.
  - Add `lib/bookings/booking-schema.ts` (zod): `teacherId` (uuid),
    `dateTime` (ISO datetime string), `hours` (number, optional, default 1),
    `location`/`isOnline` (both optional, but one of them should be set), `studentName`, `studentEmail` (email),
    `message` (optional).
  - Unit test the overlap logic in isolation (e.g. a pure `intervalsOverlap`
    helper) covering: no overlap, exact match, partial overlap, adjacent
    slots (touching but not overlapping = available).
- **Acceptance:** `vitest run` passes new tests covering the overlap cases
  above; schema rejects missing `studentName`/`studentEmail`/invalid email.
- **Depends on:** none.
- **Status:** done
- **Completed:** 2026-07-09

### 2. `POST /v1/booking` route
- **Goal:** the API endpoint that validates input, checks the teacher
  exists, checks availability, and creates the booking.
- **Steps:**
  - Add `app/v1/booking/route.ts`: parse JSON, validate with `booking-schema.ts`, 400 on failure (mirroring the existing `updateTeacherSchema` route's error shape).
  - Look up the teacher via `TeacherRepository.getById`; 404 if it doesn't exist.
  - Call `hasConflict`; if true, return 409 with a clear error message (e.g. "That time is no longer available").
  - On success, `create` the booking with `status: 'pending'` and return 201 + the created booking.
  - Log unexpected repository errors the same way `PATCH /v1/teachers` does (generic 500 to the client, details server-side).
- **Acceptance:** manual `curl` cases — valid booking → 201; unknown
  teacherId → 404; conflicting time → 409; malformed body → 400 with
  `fieldErrors`.
- **Depends on:** Task 1 (repository + schema).

### 3. Booking form on the teacher detail page
- **Goal:** the actual "select a teacher, enter date/time" user flow.
- **Steps:**
  - Add a `BookingForm` client component to the `app/teachers/[id]/page.tsx`.
  - `BookingForm` collects: date/time, hours (default 1, editable),
    location or online toggle (mirroring the teacher's own location/onlineAvailability as the default), student name, email, optional message.
  - On submit, POST to `/v1/booking`; on 409 show the "not available" error inline and let the user pick a different time; on 201 show a success state ("booking request sent — pending confirmation").
  - Client-side validation reuses `booking-schema.ts` (same pattern as `update-schema.ts` being shared between the `/profile` form and the
    `PATCH` route).
- **Acceptance:** I'll do it by myself.
- **Depends on:** Task 2 (booking endpoint + teacher lookup).

## Open questions
- INFORMATIONAL: should the booking form default the location/online choice
  from the teacher's profile, or always ask the student to choose? (Assumed:
  default from profile, but let the student override if the teacher supports
  both — no spec guidance either way.)
- INFORMATIONAL: no timezone handling is specified anywhere in the spec. This
  plan treats `dateTime` as an opaque ISO string end-to-end with no timezone
  conversion — flagging in case that's a problem for a same-day pass but
  matters later.

## Risks
- Race condition: two students could pass the conflict check for the same
  slot before either insert lands (check-then-insert, not atomic). Mitigation:
  acceptable for a same-day MVP with low concurrency; a unique constraint or
  transaction could close this gap later if it matters.
- Hand-created table schema (Task 1) could drift from what the repository
  code expects since there's no migration file enforcing it. Mitigation: the
  SQL is documented directly in the task/PR, and the Supabase integration
  tests (matching the existing `supabase-repository.test.ts` pattern) will
  fail loudly against a real project if the schema is wrong.
- Scope creep into the payment step is easy to slide into since "booking" and
  "checkout" feel like one feature. Mitigation: Task 2's acceptance criteria
  explicitly stop at `status: 'pending'` with no Stripe call.

## Definition of done
- `/teachers/[id]` page exists and is reachable in the browser (directly by
  URL — no `/teachers` list page in this plan).
- `POST /v1/booking` validates input, enforces the no-conflict rule, and
  persists a `pending` booking.
- The booking form on the teacher detail page completes the flow: pick
  teacher → enter date/time and student details → submit → see success or a
  clear "not available" error.
- New unit tests (overlap logic, schema validation) pass under `vitest run`.


## My implementation notes
- teacher has no location, just keep this field in the booking form as it is
- no need to take into acoount users timezone