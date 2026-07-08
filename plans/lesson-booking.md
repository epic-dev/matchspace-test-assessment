# Plan: Lesson booking

Date: 2026-07-08
Status: draft

## Summary
Public users can browse teachers, view a teacher's detail page, and submit a
booking request for a specific date/time. The request is rejected up front if
it conflicts with a booking the teacher already has. This plan covers the
full request flow end-to-end — browsing, selection, date/time entry,
conflict-checked submission, and persistence — but stops at creating a
`pending` booking row. Stripe checkout and payment-triggered confirmation
(`POST /v1/checkout`) are explicitly out of scope and will be a follow-up
plan. Done means: a student can go from the teacher list to a submitted
booking request without touching Supabase directly, and a double-booked slot
is rejected with a clear error instead of silently overwriting or double
allocating a teacher's time.

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
- `GET /v1/teachers` (list) currently has **no route handler at all** —
  `app/v1/teachers/route.ts` only exports `PATCH`. `GET /v1/teachers/{id}`
  doesn't exist either. Both are prerequisites for "select a teacher" and are
  built in Task 1, not assumed to pre-exist.

## Tasks

### 1. Teacher read endpoints: list + detail
- **Goal:** expose `GET /v1/teachers` and `GET /v1/teachers/{id}` so the UI
  (and the booking route's teacher-existence check) have something to call.
- **Steps:**
  - Add `list(): Promise<Teacher[]>` and `getById(id): Promise<Teacher | null>`
    to `TeacherRepository` (`lib/teachers/repository.ts`) and implement both
    on `SupabaseTeacherRepository`, reusing the existing `mapRow`.
  - Add a `GET` export to `app/v1/teachers/route.ts` returning the full
    teacher list as JSON (200).
  - Add `app/v1/teachers/[id]/route.ts` with a `GET` export: 200 + teacher
    JSON, or 404 if `getById` returns `null`.
  - No auth required on either route (public data).
- **Acceptance:** `curl /v1/teachers` returns an array; `curl
  /v1/teachers/{validId}` returns 200 with that teacher; `curl
  /v1/teachers/{bogusId}` returns 404.
- **Depends on:** none.

### 2. Public teacher list page (`/teachers`)
- **Goal:** let a public user browse teachers and pick one.
- **Steps:**
  - Add `app/teachers/page.tsx` as a server component that calls the Task 1
    list endpoint (or repository directly) and renders each teacher as a
    card: name, instruments, hourly price, online/location.
  - Each card links to `/teachers/[id]`.
  - Handle the empty-list case (no teachers yet) with a simple message.
- **Acceptance:** visiting `/teachers` in the browser shows the registered
  test teacher(s) and each card navigates to the right detail page.
- **Depends on:** Task 1.

### 3. Bookings data model + repository
- **Goal:** a place to persist booking requests, plus the conflict-check
  logic as a unit-testable pure function.
- **Steps:**
  - Document and (by hand, per the assumption above) create the `bookings`
    table: `id, teacher_id, date_time, hours, location, is_online,
    student_name, student_email, message, status, created_at`.
  - Add `lib/bookings/repository.ts`: `Booking` domain type,
    `CreateBookingInput`, and a `BookingRepository` port with
    `create(input)` and `hasConflict(teacherId, dateTime, hours)`.
  - Add `lib/bookings/supabase-repository.ts` implementing the port.
    `hasConflict` queries existing bookings for the teacher and checks
    interval overlap against `[dateTime, dateTime + hours)`.
  - Add `lib/bookings/booking-schema.ts` (zod): `teacherId` (uuid),
    `dateTime` (ISO datetime string), `hours` (number, default 1),
    `location`/`isOnline` (optional), `studentName`, `studentEmail` (email),
    `message` (optional).
  - Unit test the overlap logic in isolation (e.g. a pure `intervalsOverlap`
    helper) covering: no overlap, exact match, partial overlap, adjacent
    slots (touching but not overlapping = available).
- **Acceptance:** `vitest run` passes new tests covering the overlap cases
  above; schema rejects missing `studentName`/`studentEmail`/invalid email.
- **Depends on:** none.

### 4. `POST /v1/booking` route
- **Goal:** the API endpoint that validates input, checks the teacher
  exists, checks availability, and creates the booking.
- **Steps:**
  - Add `app/v1/booking/route.ts`: parse JSON, validate with
    `booking-schema.ts`, 400 on failure (mirroring the existing
    `updateTeacherSchema` route's error shape).
  - Look up the teacher via Task 1's `getById`; 404 if it doesn't exist.
  - Call `hasConflict`; if true, return 409 with a clear error message
    (e.g. "That time is no longer available").
  - On success, `create` the booking with `status: 'pending'` and return
    201 + the created booking.
  - Log unexpected repository errors the same way `PATCH /v1/teachers`
    does (generic 500 to the client, details server-side).
- **Acceptance:** manual `curl` cases — valid booking → 201; unknown
  teacherId → 404; conflicting time → 409; malformed body → 400 with
  `fieldErrors`.
- **Depends on:** Task 1 (teacher lookup), Task 3 (repository + schema).

### 5. Booking form on the teacher detail page
- **Goal:** the actual "select a teacher, enter date/time" user flow.
- **Steps:**
  - Add `app/teachers/[id]/page.tsx`: server component fetching the teacher
    via Task 1 and rendering profile details (bio, instruments, credentials,
    hourly price, location/online) plus a `BookingForm` client component.
  - `BookingForm` collects: date/time, hours (default 1, editable),
    location or online toggle (mirroring the teacher's own
    location/onlineAvailability as the default), student name, email,
    optional message.
  - On submit, POST to `/v1/booking`; on 409 show the "not available" error
    inline and let the user pick a different time; on 201 show a success
    state ("booking request sent — pending confirmation").
  - Client-side validation reuses `booking-schema.ts` (same pattern as
    `update-schema.ts` being shared between the `/profile` form and the
    `PATCH` route).
- **Acceptance:** in the browser — pick a teacher from `/teachers`, submit a
  valid booking, see the success state; submit the same slot again and see
  the 409 error surfaced in the form.
- **Depends on:** Task 2 (detail page shell), Task 4 (booking endpoint).

## Open questions
- BLOCKS-EXECUTION: is hand-creating the `bookings` table via the Supabase
  SQL editor actually the right call, or should this plan add a migrations
  folder/file now that a second table is being introduced? (Assumed: follow
  existing `teachers`-table precedent, no migration file.)
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
- Hand-created table schema (Task 3) could drift from what the repository
  code expects since there's no migration file enforcing it. Mitigation: the
  SQL is documented directly in the task/PR, and the Supabase integration
  tests (matching the existing `supabase-repository.test.ts` pattern) will
  fail loudly against a real project if the schema is wrong.
- Scope creep into the payment step is easy to slide into since "booking" and
  "checkout" feel like one feature. Mitigation: Task 4's acceptance criteria
  explicitly stop at `status: 'pending'` with no Stripe call.

## Definition of done
- `GET /v1/teachers` and `GET /v1/teachers/{id}` are implemented and return
  real data.
- `/teachers` and `/teachers/[id]` pages exist and are reachable in the
  browser.
- `POST /v1/booking` validates input, enforces the no-conflict rule, and
  persists a `pending` booking.
- The booking form on the teacher detail page completes the flow: pick
  teacher → enter date/time and student details → submit → see success or a
  clear "not available" error.
- New unit tests (overlap logic, schema validation) pass under `vitest run`.
