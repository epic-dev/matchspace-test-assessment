const GENERIC_ERROR = "Something went wrong. Please try again.";

export type StartCheckoutResult = { ok: true } | { ok: false; error: string };

/**
 * Calls `POST /v1/checkout` for a given booking and, on success, redirects
 * the browser to the returned Stripe-hosted Checkout URL. Never throws — any
 * failure (non-OK response, network error, malformed body) resolves to an
 * `{ ok: false, error }` result the caller can render inline.
 *
 * Shared by the auto-redirect on booking creation and the manual retry
 * button so both paths call `/v1/checkout` the exact same way.
 */
export async function startCheckout(bookingId: string): Promise<StartCheckoutResult> {
  try {
    const response = await fetch("/v1/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return { ok: false, error: data?.error ?? GENERIC_ERROR };
    }

    if (!data?.url) {
      return { ok: false, error: GENERIC_ERROR };
    }

    window.location.href = data.url;
    return { ok: true };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}
