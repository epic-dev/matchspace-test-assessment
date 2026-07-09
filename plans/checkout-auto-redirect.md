# Plan: Automatic checkout redirect on booking creation

Date: 2026-07-09
Status: draft

## Summary
Currently, `POST /v1/booking` succeeds and `BookingForm` just shows a static "pending confirmation" message — the student has to be handed off to checkout manually (a `ProceedToCheckoutButton` component exists but, per its own comment, isn't wired into any page). This plan closes that gap: once a booking is created (status `pending`), the app immediately calls `POST /v1/checkout` for that booking and redirects the browser to the Stripe-hosted payment page, with no extra click. If that checkout call fails (network error, teacher missing an hourly price, etc.), the booking is not lost — the student sees an inline error and a retry button. Because auto-trigger-then-possibly-retry means `/v1/checkout` can legitimately be called more than once for the same booking, this plan also makes that endpoint idempotent at the Stripe level so a retry can never mint two live payment sessions for one booking. "Done" means: submitting the booking form takes the student straight to a real Stripe test-mode Checkout page, and no failure/retry path can duplicate either the booking or the payment session.

## Assumptions
- `POST /v1/booking` already returns the created `Booking` (including `id`) with `status: 201` — confirmed in `app/v1/booking/route.ts`.
- `POST /v1/checkout` already exists, works, and returns `{ url }` — confirmed in `app/v1/checkout/route.ts`. This plan does not change its request/response contract, only adds an idempotency key to the internal Stripe call and (Task 3) how it's invoked from the client.
- `ProceedToCheckoutButton` (`components/ProceedToCheckoutButton.tsx`) already implements the fetch-and-redirect behavior correctly; it's reused (via a shared helper) rather than rewritten.
- No component-testing library (e.g. React Testing Library) is installed — consistent with the stripe-checkout plan's Task 5 note, UI components are verified manually in the browser, not via automated component tests. `startCheckout` itself (a plain function, not a component) is unit-testable with a mocked `fetch`.
- Idempotency is scoped to `/v1/checkout` only. `/v1/booking` already has slot-conflict detection (`hasConflict`); a client-generated idempotency key to fully dedupe booking creation itself is a separate, larger change and is explicitly out of scope here.
- Currency/pricing logic (`booking.hours * teacher.hourlyPrice`, rounded to cents) is unchanged — the idempotency key only needs to be stable per booking, not encode the price itself.

## Tasks

### 1. Idempotent Stripe Checkout Session creation
- **Goal:** Ensure any retried call to `/v1/checkout` for the same booking never creates a second live Stripe Checkout Session.
- **Steps:**
  1. In `app/v1/checkout/route.ts`, pass Stripe request options as a second argument to `stripe.checkout.sessions.create(params, { idempotencyKey })`, where `idempotencyKey` is deterministic and derived from `booking.id` (e.g. `` `checkout-session:${booking.id}` ``).
  2. Verify the installed `stripe` SDK's `.create()` signature accepts request options as a second argument (check its TypeScript types).
  3. Extend `app/v1/checkout/route.test.ts` to assert the mocked `stripe.checkout.sessions.create` call receives the expected `idempotencyKey`, derived from the booking id used in the test.
- **Acceptance:** `npm run test` passes, including the new idempotency-key assertion; `tsc --noEmit` clean.
- **Depends on:** none.

### 2. Shared checkout-initiation client helper
- **Goal:** One tested code path for "call `POST /v1/checkout` and either redirect to Stripe or return a usable error," so the new auto-trigger and the existing manual retry button don't duplicate the same fetch logic.
- **Steps:**
  1. Add `lib/bookings/checkout-client.ts` exporting `startCheckout(bookingId: string): Promise<{ ok: true } | { ok: false; error: string }>`. On a successful response, sets `window.location.href = url` and resolves `{ ok: true }`. On a non-OK response, resolves `{ ok: false, error }` using the response body's `error` field (falling back to a generic message). On a thrown/network error, resolves `{ ok: false, error }` with a generic message. Never throws.
  2. Refactor `components/ProceedToCheckoutButton.tsx` to call `startCheckout` instead of its inline `fetch` logic. Its existing submitting/disabled/error UI behavior is unchanged — only the fetch call moves.
  3. Unit test `startCheckout` (mocking global `fetch`): OK response → returns `{ ok: true }` and sets `location.href`; non-OK response with an `error` body → returns that exact message; thrown error → returns the generic fallback message.
- **Acceptance:** `npm run test` passes (new `checkout-client.test.ts`, no behavior change in `ProceedToCheckoutButton` — verify manually in the browser that its click-to-redirect flow still works); `tsc --noEmit` clean.
- **Depends on:** none (can run in parallel with Task 1).

### 3. Auto-redirect `BookingForm` to checkout after booking creation
- **Goal:** Once a booking is created, take the student straight to Stripe's hosted payment page with no extra click; if that fails, give them a clear retry action instead of losing the booking.
- **Steps:**
  1. In `app/teachers/[id]/BookingForm.tsx`, replace the `success: boolean` state with `phase: 'idle' | 'redirecting' | 'checkout-failed'` and `createdBookingId: string | null`.
  2. On `201` from `POST /v1/booking`, read the response body's `id`, set `phase = 'redirecting'` and `createdBookingId`, then call `startCheckout(id)` (Task 2). While `phase === 'redirecting'`, show a brief "Redirecting to payment…" status.
  3. On success, no further rendering is needed — the browser navigates away. On failure, set `phase = 'checkout-failed'`, show the returned error message alongside "Your booking was saved — we just couldn't start checkout," and render `<ProceedToCheckoutButton bookingId={createdBookingId} />` as the retry action.
  4. Once a booking has been created (`phase !== 'idle'`), hide the form fields and the "Request booking" submit button — resubmitting would create a duplicate pending booking for the same slot; only the retry button should remain interactive.
- **Acceptance:** `npm run test` passes; `tsc --noEmit` clean; manual browser check: submitting a valid booking redirects to a real Stripe test-mode Checkout page; forcing a checkout failure (e.g. a teacher with no `hourlyPrice`) shows the retry button, and clicking it (Task 1's idempotency key covers this being a retry of the same booking) succeeds once the underlying issue is resolved.
- **Depends on:** 2.

## Open questions
INFORMATIONAL:
- None blocking — this design was walked through and approved in conversation before this plan was written.

## Risks
- **Idempotency key + changed params**: if the same booking were somehow checked out twice with different computed amounts (e.g. teacher's `hourlyPrice` changed between calls), Stripe would reject the second call since idempotent requests must match their original parameters exactly. Mitigation: price is always computed fresh from the booking's stored `hours` and the teacher's *current* `hourlyPrice` at checkout time and isn't expected to change within one booking's short lifecycle — accepted, not defended against further.
- **Auto-redirect leaves no confirmation moment**: the student's browser navigates to Stripe immediately, with no pause to review what was submitted. Mitigation: none — this is the explicitly chosen behavior over a confirm-and-click step.
- **Form hides on any checkout failure, even transient ones**: if `startCheckout` fails, the student can only retry via the smaller `ProceedToCheckoutButton`, not resubmit the original form. Mitigation: acceptable since the booking already exists — resubmitting the form would create a duplicate, which is worse.

## Definition of done
- Submitting `BookingForm` with valid data creates the booking, then automatically redirects the browser to a real Stripe test-mode Checkout page for that booking's computed amount — no manual click required.
- If checkout initiation fails after a successful booking creation, the student sees an inline error and a working retry button; the booking itself is never lost, and resubmitting the form is not possible (preventing duplicate bookings).
- Any retried call to `/v1/checkout` for the same booking (auto-trigger followed by manual retry, or any other duplicate call) never creates more than one live Stripe Checkout Session for that booking — verified by the idempotency-key test in Task 1.
- `npm run test` and `tsc --noEmit` both pass with no regressions.
