"use client";

import { useState } from "react";

import { startCheckout } from "@/lib/checkout/checkout-client";

type ProceedToCheckoutButtonProps = {
  bookingId: string;
  /**
   * Seeds the error shown before any click — e.g. `BookingForm`'s
   * auto-redirect failure reason. Once the button is clicked, its own
   * submit/error state takes over and supersedes this, so a failed retry
   * never stacks a second error message underneath the seeded one.
   */
  initialError?: string | null;
};

/**
 * Reusable trigger for `POST /v1/checkout`, used both as the manual retry
 * action (when `BookingForm`'s auto-redirect fails) and standalone wherever
 * a booking already exists. On success, redirects the whole page to
 * Stripe's hosted Checkout page; on failure, shows an inline error instead of
 * throwing.
 */
export function ProceedToCheckoutButton({
  bookingId,
  initialError = null,
}: ProceedToCheckoutButtonProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  async function handleClick() {
    setError(null);
    setSubmitting(true);

    const result = await startCheckout(bookingId);
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
    }
    // On success, startCheckout has already navigated the browser away —
    // no further state update is needed.
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={submitting}
        onClick={handleClick}
        className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {submitting ? "Redirecting…" : "Proceed to payment"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
