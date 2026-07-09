# Review: Automatic checkout redirect on booking creation

Date: 2026-07-09
Reviewer: independent senior full-stack review
Target: `plans/checkout-auto-redirect.md` (Tasks 1-3), commits `adfe9f9..bd87d20`
Base: `49b49ab` (merge-base of `main` and this branch)
Head: `bd87d20`
Files changed: 7
Lines: +277 / -52

## Verdict
APPROVE-WITH-COMMENTS

Correct, well-scoped implementation of the plan with a real idempotency guarantee verified against the installed Stripe SDK's types, but there's a genuine duplicate-error-message UX bug and an unhandled JSON-parse edge case that undermines the PR's own core invariant ("resubmitting is impossible once a booking exists").

## Summary
This diff adds a Stripe idempotency key to `/v1/checkout`, extracts a shared `startCheckout` client helper, and rewires `BookingForm` to auto-redirect to Stripe Checkout immediately after a booking is created, falling back to a retry button on failure. The Stripe SDK's `.create(params, options)` overload and `RequestOptions.idempotencyKey` were verified directly against `node_modules/stripe/cjs/lib.d.ts` — the idempotency claim in Task 1 is accurate, not just asserted. The three tasks are implemented as specified and each has focused test coverage where the codebase's own testing conventions allow it (no component-testing library, per `checkout-client.test.ts`'s window-stubbing approach). Two real issues stood out: (1) `BookingForm.tsx:121`'s `await response.json()` on the 201 path is unguarded — if it throws, the code falls through to a generic catch that leaves `phase` at `"idle"`, re-showing the form and permitting a duplicate booking for an already-created record, which is exactly the invariant Task 3 was written to prevent; (2) the parent's `checkoutError` (set once on the auto-redirect failure) is never cleared, so a failed manual retry via `ProceedToCheckoutButton` stacks its own error message underneath the stale one, showing the student two error paragraphs. Note: `git diff main..HEAD` also showed an unrelated `.claude/skills/planner/SKILL.md` diff — that's an artifact of `main` having advanced past this branch's base with an unrelated commit (`06c57a3`), not something this branch introduced; the actual feature diff (against merge-base `49b49ab`) is the 7 files listed above.

## Findings

### ⚠️ Should fix
- [ ] **`ms-next-app/app/teachers/[id]/BookingForm.tsx:121`** — `const created: { id: string } = await response.json();` is unguarded inside the `try` block, directly after a confirmed `201` (i.e., the booking already exists in the DB). If this throws (truncated response body, connection drop right after the status line — rare but real on flaky mobile networks), execution falls into the generic `catch { setFormError(...) }` at line 156-157. `phase` was never advanced past `"idle"`, so the form re-renders fully interactive, and the student can resubmit — creating a second booking for the same slot for a request that already succeeded server-side. This is precisely the duplicate-booking scenario the `phase !== "idle"` guard (lines 163-190) was built to prevent. **Fix:** once `response.status === 201` is confirmed, treat the booking as created unconditionally (e.g. `setPhase("redirecting")` — or a new `checkout-unreadable` phase — before/regardless of parsing the body), and wrap the `response.json()` call in its own `.catch()` so a parse failure can't fall through to the pre-creation error path. At minimum, never let a post-201 failure route back to the `formError`/interactive-form branch.

- [ ] **`ms-next-app/app/teachers/[id]/BookingForm.tsx:60,129,180-184`** — `checkoutError` is set once (line 129) when the auto-redirect's `startCheckout` call fails, and is never cleared. `ProceedToCheckoutButton` (rendered right below it at line 185) tracks its own independent `error` state and renders its own error paragraph on failure. If the student clicks the retry button and it fails again, the UI shows **two** stacked error messages: the stale one from the original auto-redirect failure (line 180-184) plus the fresh one from the button's own retry (`ProceedToCheckoutButton.tsx:45-49`) — confusing, and gets worse if the two failures have different causes. **Fix:** pick one owner for the error message. Either drop the `checkoutError` paragraph from `BookingForm` entirely and rely solely on `ProceedToCheckoutButton`'s own error UI (simplest — the button already surfaces failures), or give `ProceedToCheckoutButton` an `onError`/controlled-error prop so `BookingForm` can supersede its own message with the latest retry result instead of stacking both.

### 💭 Nits
- [ ] **`ms-next-app/app/teachers/[id]/BookingForm.tsx:177-179`** — The "Your booking was saved — we just couldn't start checkout" message uses `text-green-600` (success-green) even though it's announcing a partial *failure*. Green here reads as "all good" before the student has scanned the red error line below it. Consider a neutral/amber tone instead, or move the reassurance text after the error line.
- [ ] Prior tasks in this repo's history (`1ce9d80`, `25e368b`, `e1fc7b0`, `1115cab`, `28b443c`) each landed as one commit per plan task. This PR squashes all three tasks of `checkout-auto-redirect.md` into a single commit (`bd87d20`). Given the tasks are small and tightly coupled (3 depends on 2), this is defensible, but it breaks the established per-task commit convention and makes it harder to `git bisect`/review task-by-task later.

### 💡 Suggestions
- [ ] `BookingForm.tsx:121`'s hard type-cast (`{ id: string }`) trusts the server response shape with no runtime check, unlike the rest of the same function which defensively does `await response.json().catch(() => null)` before optional-chaining (lines 135, 139, 146). Not urgent given same-origin, same-repo control of both ends, but worth aligning the two parsing styles for consistency the next time this file is touched. (Related to the Should-fix above — fixing that will likely fix this too.)
- [ ] Stripe idempotency keys expire after Stripe's default window (24h). If a student abandons a `checkout-failed` booking and retries days later, the key collision risk disappears but so does the dedupe protection — a fresh session gets minted. Not a bug (out of scope per the plan's own Risks section), just worth knowing if support ever asks "why does this booking have two Stripe sessions."

## Test coverage
- `ms-next-app/lib/bookings/checkout-client.test.ts` (new): covers `startCheckout`'s four outcomes — success + redirect, non-OK with error body, non-OK with no body, and thrown/network error. Good, focused, matches the helper's stated contract.
- `ms-next-app/app/v1/checkout/route.test.ts`: extended with an assertion that `stripe.checkout.sessions.create` receives `{ idempotencyKey: 'checkout-session:${booking.id}' }`. Verifies Task 1's core claim directly.
- No automated coverage for `BookingForm.tsx`'s new `phase` state machine (idle → redirecting → checkout-failed, and the form-hiding behavior) — consistent with this codebase's established constraint (no RTL/component-testing library installed, per the plan's own Assumptions and prior Task 5 precedent), so this isn't new drift. But it does mean the two Should-fix bugs above (both in `BookingForm.tsx`) are exactly the class of regression that would have been caught by a component test and currently has zero net around it. If RTL gets added later, this file is the first candidate for coverage.
- `ProceedToCheckoutButton.tsx`'s refactor to call `startCheckout` is covered indirectly (it's now a thin wrapper around the tested helper) but the component itself has no direct test — acceptable for the same reason.

## Convention drift
- All three plan tasks landed in a single commit rather than one-per-task (see Nits above) — not a `CLAUDE.md → Conventions` violation (commit granularity isn't specified there), but a deviation from this repo's own established pattern.

## Out-of-scope changes
- None in the actual feature diff. `git diff main..HEAD` shows `.claude/skills/planner/SKILL.md` changing, but that content is not touched by either commit on this branch (`adfe9f9`, `bd87d20`) — `main` advanced independently past this branch's base with an unrelated commit (`06c57a3`, "Wire planner skill to invoke brainstorming for design exploration"). Confirmed via `git diff 49b49ab..HEAD` (merge-base), which excludes that file. No action needed here.

## Plan critique
None. The plan is well-scoped, its Assumptions section correctly anticipated the Stripe SDK signature question and resolved it with a verifiable check ("verify its TypeScript types" — done, confirmed above), and its Risks section explicitly and correctly reasons about the idempotency-key/changed-params edge case and the no-confirmation-moment UX tradeoff. The two Should-fix bugs found in this review are implementation gaps within Task 3, not plan-level design flaws — the plan's stated intent ("resubmitting the form is not possible") is correct; the code just doesn't fully deliver it on the JSON-parse-failure path.
