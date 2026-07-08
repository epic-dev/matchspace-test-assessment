## Project
A SaaS platform for music teachers to build a public profile (credentials, instruments, bio, availability, hourly price), receive lesson booking requests from students, and accept payment for bookings via Stripe.

## Tech stack
- Language: TypeScript
- Framework: Next.js (latest, App Router), React 19
- Validation: zod
- Payments: Stripe (client + server, test mode)
- Database & Auth: Supabase (auth handled by Supabase — no custom auth implementation needed)
- Backend pattern: simple repositories/adapters/ports; Next.js server actions for Stripe calls and DB operations
- Deployment: Vercel (primary), Docker image (alternative)

## Assessment spec
- Full spec: @PROJECT_SPEC.md
- Users register as a teacher (`POST /v1/register`) to create a public profile: name, instrument(s), bio, credentials/education, lesson location or online availability, hourly price.
- Teachers set available lesson times and receive booking requests.
- Public users can list all teachers (`GET /v1/teachers`) and view teacher details (`GET /v1/teachers/{id}`).
- Public users can book a lesson (`POST /v1/booking`) with student name, email, requested date/time, optional message — no student account required.
- Booking is confirmed only after a successful test-mode Stripe payment (`POST /v1/checkout`).
- `PATCH /v1/teachers` updates the **currently authenticated** teacher's profile (identified via Supabase session — no id in the request).

## Deliverable
- Repo URL: _placeholder — to be filled in once created_
- Live demo URL: _placeholder — to be filled in once deployed_

## Conventions
- Code style/linting: not specified in spec — default to standard Next.js (`create-next-app`) ESLint config unless the user says otherwise.
- Testing: light unit tests with Vitest, focused on core business logic (booking creation, pricing/availability rules). No e2e tests for this pass, given the same-day timeframe.
- Commit style: not specified in spec — plain, descriptive commit messages; user makes their own commits.

## Working with the user
- User: senior full-stack engineer, frontend-leaning.
- Wants senior-signal code, not cargo cult. Prefers small reviewable diffs over large sprawling PRs.
- Timeframe is tight (same-day) — bias toward the smallest correct implementation of the functional requirements over polish or speculative extensibility.
- Ask before large changes. When in doubt, offer 2-3 concrete choices rather than open-ended "any preference?"
- Never skip git hooks, force-push, or bypass signing without explicit approval.
- The user makes their own commits unless explicitly asked otherwise.

## Out of scope
- Non-functional requirements (explicitly skipped in spec: performance, scaling, security hardening beyond what Supabase/Stripe provide out of the box, etc.).
- Custom authentication/authorization implementation — delegated entirely to Supabase Auth.
- Anti-spam/anti-abuse measures for public, account-less booking requests — flagged as a consideration in work_log.md but not a stated requirement; deferred given the same-day timeframe.

## Reference material
- @PROJECT_SPEC.md
