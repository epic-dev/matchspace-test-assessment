"use client";

import { useState } from "react";

type ProceedToCheckoutButtonProps = {
  bookingId: string;
};

/**
 * Standalone, reusable trigger for `POST /v1/checkout`. Not wired into any
 * page yet — the booking-confirmation UI (built in a separate session) will
 * render this once a booking exists. On success, redirects the whole page to
 * Stripe's hosted Checkout page; on failure, shows an inline error instead of
 * throwing.
 */
export function ProceedToCheckoutButton({ bookingId }: ProceedToCheckoutButtonProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/v1/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      const data = await response.json().catch(() => null);
      if (!data?.url) {
        setError("Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
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
