# Plan: Stripe checkout for bookings

Date: 2026-07-08
Status: draft

## Summary
Add Stripe (test mode) payment to the booking flow: once a booking exists, the student proceeds to checkout, which creates a Stripe Checkout Session for the booking's amount and redirects to Stripe's hosted payment page. A webhook confirms the booking server-side once Stripe reports the payment as complete (`checkout.session.completed`), independent of whether the student's browser makes it back to the app. This plan covers `POST /v1/checkout`, the webhook, and the minimal UI to trigger/land the flow — it does **not** cover booking creation itself (`POST /v1/booking`), which is being built in a separate session and is treated here as an external dependency. "Done" means: given an existing pending booking, a test-mode Stripe payment can be completed end-to-end and the booking's stored status flips to confirmed via the webhook, with no separate `payments` table (payment fields live on the booking row, per your choice).

## Assumptions
- ⚠️ The `bookings` table/repository exists with columns: `id, teacher_id, date_time, hours, location, is_online, student_name, student_email, message, status, created_at`.
- This plan adds the payment-related fields itself: `stripe_session_id` (text, nullable) and `payment_status` (`'pending' | 'paid'`, default `'pending'`) on the `bookings` row — no separate `payments` table, per your answer.
- Booking amount = `booking.hours * teacher.hourlyPrice`, computed server-side at checkout-creation time (not trusted from the client, not stored redundantly on the booking row ahead of time).
- Checkout uses Stripe **Checkout Sessions** (hosted payment page) — no Stripe Elements/client-side card form, no `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` needed, since the flow is a server-created session + redirect to `session.url`.
- Confirmation source of truth is a **Stripe webhook** (`checkout.session.completed`), not the success-page redirect — the success/cancel pages are UI-only and don't themselves mutate booking state.
- Local webhook testing uses the Stripe CLI (`stripe listen --forward-to localhost:3000/v1/stripe/webhook`) — this is a manual dev-environment step, not something the code needs to automate.
- Test mode only: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are Stripe test-mode values, added to `ms-next-app/.env` (not read in this session — file is env-blocked per prior work_log note — so exact var names are proposed, not verified against a real `.env` yet).
- No student account/auth on this path (per spec) — the checkout route is a public endpoint identified by `bookingId`, not a session.
- Currency: EUR.
- ⚠️ POST-HOC (Task 1, 2026-07-09): per explicit user instruction during execution, skipped writing the Vitest unit test for `lib/stripe/client.ts` (and unit testing generally for subsequent tasks in this pass). `tsc --noEmit` and the existing test suite (`npm run test`) were still run and pass; no regression introduced. Flagging since the plan's task 1/4/5 and "Definition of done" call for new tests per task — that bar was explicitly waived for this execution pass, not silently dropped.

## Tasks

### 1. Stripe SDK setup
- **Goal:** Get the Stripe server SDK installed and configured so later tasks can create sessions and verify webhooks.
- **Steps:**
  1. Install `stripe` (server SDK) as a dependency in `ms-next-app`.
  2. Add `lib/stripe/client.ts` exporting a singleton `Stripe` instance constructed from `process.env.STRIPE_SECRET_KEY`, throwing a clear error if the env var is missing (mirrors the existing `lib/supabase/env.ts` pattern of failing loudly on missing config).
  3. Document the two new required env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
  4. Unit test: constructing the client with the env var unset throws; with it set, returns a `Stripe` instance (no network call needed).
- **Acceptance:** `npm run test` passes; `tsc --noEmit` passes; no secret value is logged or committed.
- **Depends on:** none.
- **Status:** done
- **Completed:** 2026-07-09

### 2. Extend booking storage with payment fields
- **Goal:** Add the two payment-tracking columns to the (external) `bookings` table and expose the repository methods this integration needs, reconciling against whatever the booking-creation session actually shipped.
- **Steps:**
  1. Extend the booking repository port with `getById(id): Promise<Booking | null>`, `attachStripeSession(id, sessionId): Promise<void>`, and `markPaid(id): Promise<void>` (or adapt to whatever methods already exist rather than duplicating).
  2. Unit test the three new/adapted repository methods against a mocked Supabase client.
- **Acceptance:** `npm run test` passes; `tsc --noEmit` passes; methods compile against the real `Booking` type from the other session (not a locally-invented duplicate type).
- **Depends on:** 1 (only for shared conventions; can start in parallel once the real booking shape is known).
- **Status:** blocked
- **Blocked reason:** no `bookings` table, repository, or `Booking` type exists anywhere in `ms-next-app` as of 2026-07-09 (checked via `find` across the repo for any `*booking*` file). The plan explicitly treats booking creation as an external dependency being built in a separate session, and the acceptance criterion requires extending the *real* `Booking` type rather than inventing a duplicate — that real type doesn't exist yet, so this task cannot be completed as written. Needs a re-plan/check-in once the booking-creation session lands, or an explicit decision to have this session define the booking repository itself (which would be a scope change from the plan's stated assumption).

### 3. `POST /v1/checkout` route handler
- **Goal:** Given a `bookingId`, create a Stripe Checkout Session for the correct amount and return its URL for the client to redirect to.
- **Steps:**
  1. Define a zod schema for the request body: `{ bookingId: string }`.
  2. Route handler (`app/v1/checkout/route.ts`): load the booking via the repository (404 if missing), load the teacher via the existing teacher repository to get `hourlyPrice`, compute `amount = hours * hourlyPrice` in cents.
  3. Create a Stripe Checkout Session (`mode: 'payment'`, one line item describing the lesson booking, `success_url`/`cancel_url` pointing at new `/booking/success` and `/booking/cancel` pages, `metadata: { bookingId }` so the webhook can look the booking back up).
  4. Persist the session id on the booking via `attachStripeSession`; return `{ url: session.url }`.
  5. Unit test the route: valid booking → 200 + url, unknown booking → 404, Stripe API failure → mapped 500.
- **Acceptance:** `npm run test` passes; manual `curl -X POST localhost:3000/v1/checkout -d '{"bookingId":"..."}'` against a real (test-mode) booking returns a working `checkout.stripe.com` URL that renders Stripe's test payment page.
- **Depends on:** 1, 2.

### 4. Stripe webhook: confirm booking on payment success
- **Goal:** Receive Stripe's server-to-server `checkout.session.completed` event and mark the corresponding booking as paid.
- **Steps:**
  1. Route handler (`app/v1/stripe/webhook/route.ts`) that reads the raw request body (`request.text()`) and verifies the signature via `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)`, returning 400 on a bad signature.
  2. On `checkout.session.completed`, read `bookingId` from `session.metadata`, call `markPaid(bookingId)`. Ignore/200 on any other event type.
  3. Make the handler idempotent — calling `markPaid` twice for the same booking (Stripe can redeliver events) must not error or double-charge/side-effect.
  4. Unit test: valid signed event → booking marked paid; invalid signature → 400; unhandled event type → 200 no-op; redelivered event → no error.
- **Acceptance:** `npm run test` passes; manual end-to-end check using `stripe listen --forward-to localhost:3000/v1/stripe/webhook` + `stripe trigger checkout.session.completed` (or a real test-mode card payment via Task 3's URL) results in the booking's `payment_status` flipping to `paid`.
- **Depends on:** 1, 2.

### 5. Checkout trigger UI + success/cancel pages
- **Goal:** Give the student a way to reach Stripe after booking, and land somewhere sensible on return.
- **Steps:**
  1. A small client component (e.g. `ProceedToCheckoutButton`) that `POST`s to `/v1/checkout` with a `bookingId` prop, then `window.location.href = url` on success — built so the other session's booking-confirmation UI can drop it in once that flow lands, not wired into a specific page yet.
  2. `app/booking/success/page.tsx`: static confirmation message ("Payment received — your booking is confirmed" / "we're finalizing your booking"), no server-side status mutation (webhook already handled it).
  3. `app/booking/cancel/page.tsx`: static "payment was cancelled, you can try again" message.
  4. No new UI dependencies; keep styling consistent with existing Tailwind setup.
- **Acceptance:** visiting `/booking/success` and `/booking/cancel` directly renders the expected static content; `ProceedToCheckoutButton` redirects to a real Stripe test-mode URL when given a valid `bookingId`.
- **Depends on:** 3.

## Open questions

INFORMATIONAL:
- Currency assumed USD — confirm if something else is needed.
- Confirm `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` as the env var names (can't read `.env` from this session per prior sandbox restriction noted in `plans/teacher-registration.md`).
- Confirm `/booking/success` and `/booking/cancel` as acceptable route names (not specified in spec).
- Should `payment_status` also gate a broader `bookings.status` field (e.g. `pending` → `confirmed`) if the other session's booking schema already has its own status column, or is `payment_status` sufficient on its own? Reconcile alongside Task 2.

## Risks
- **Booking schema not landed yet**: this plan is written against an assumed booking shape since the real one is being built in parallel. Mitigation: Task 2 starts with a reconciliation step against the real schema before writing any migration/repository code.
- **Webhook signature/env misconfiguration**: wrong `STRIPE_WEBHOOK_SECRET` silently rejects all events (bookings never confirm). Mitigation: Task 4's acceptance check exercises a real signed event via the Stripe CLI, not just unit tests with a mocked signature.
- **Duplicate/out-of-order webhook delivery**: Stripe can redeliver the same event or deliver events out of order. Mitigation: `markPaid` is written to be idempotent (Task 4, step 3) rather than assuming exactly-once delivery.
- **Amount drift**: if hourly price changes between booking creation and checkout, the charged amount could differ from what the student saw. Mitigation: out of scope for same-day timeframe — accepted risk, not handled.

## Definition of done
- `POST /v1/checkout` creates a real Stripe test-mode Checkout Session for an existing booking and returns a redirectable URL.
- Completing a test-mode payment on that Stripe-hosted page results in the corresponding booking's `payment_status` becoming `paid`, driven by a verified webhook call, not client-side trust.
- `/booking/success` and `/booking/cancel` render without error.
- `npm run test` passes, including new tests for the Stripe client, repository extensions, checkout route, and webhook route.
- No Stripe secret key or webhook secret is logged, committed, or exposed to the client.


## My implementation notes
- currency EUR