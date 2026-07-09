import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startCheckout } from "../lib/checkout/checkout-client";

const bookingId = "11111111-1111-4111-8111-111111111111";

// This project's vitest environment is "node" (no jsdom/happy-dom
// installed), so there is no real `window` global — stub a minimal one
// with a writable `location.href` for `startCheckout`'s redirect to assign.
let fakeWindow: { location: { href: string } };

describe("startCheckout", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    fakeWindow = { location: { href: "" } };
    vi.stubGlobal("window", fakeWindow);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns { ok: true } and redirects to the checkout url on a successful response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://checkout.stripe.com/pay/cs_test_123" }),
    }) as unknown as typeof fetch;

    const result = await startCheckout(bookingId);

    expect(result).toEqual({ ok: true });
    expect(fakeWindow.location.href).toBe("https://checkout.stripe.com/pay/cs_test_123");
    expect(global.fetch).toHaveBeenCalledWith(
      "/v1/checkout",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      }),
    );
  });

  it("returns the response body's error message on a non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "This teacher has not set an hourly price yet" }),
    }) as unknown as typeof fetch;

    const result = await startCheckout(bookingId);

    expect(result).toEqual({
      ok: false,
      error: "This teacher has not set an hourly price yet",
    });
    expect(fakeWindow.location.href).toBe("");
  });

  it("returns a generic fallback message when a non-OK response has no error body", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => null,
    }) as unknown as typeof fetch;

    const result = await startCheckout(bookingId);

    expect(result).toEqual({
      ok: false,
      error: "Something went wrong. Please try again.",
    });
  });

  it("returns a generic fallback message when fetch throws", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const result = await startCheckout(bookingId);

    expect(result).toEqual({
      ok: false,
      error: "Something went wrong. Please try again.",
    });
    expect(fakeWindow.location.href).toBe("");
  });
});
