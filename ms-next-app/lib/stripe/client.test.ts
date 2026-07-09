import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEY = "STRIPE_SECRET_KEY";

describe("stripe client", () => {
  const originalValue = process.env[ENV_KEY];

  beforeEach(() => {
    // The client module caches a module-level singleton across calls within
    // the same module instance, so each test re-imports the module fresh to
    // avoid one test's cached client leaking into the next.
    vi.resetModules();
  });

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalValue;
    }
  });

  it("getStripeClient throws when STRIPE_SECRET_KEY is unset", async () => {
    delete process.env[ENV_KEY];

    const { getStripeClient } = await import("./client");

    expect(() => getStripeClient()).toThrow(
      "Missing required environment variable: STRIPE_SECRET_KEY",
    );
  });

  it("getStripeSecretKey throws when STRIPE_SECRET_KEY is unset", async () => {
    delete process.env[ENV_KEY];

    const { getStripeSecretKey } = await import("./client");

    expect(() => getStripeSecretKey()).toThrow(
      "Missing required environment variable: STRIPE_SECRET_KEY",
    );
  });

  it("getStripeClient returns a Stripe instance when the key is set, without a network call", async () => {
    process.env[ENV_KEY] = "sk_test_fake_key_for_unit_tests";

    const { getStripeClient } = await import("./client");

    const client = getStripeClient();

    expect(client).toBeInstanceOf(Stripe);
  });

  it("getStripeClient returns the same singleton instance across calls", async () => {
    process.env[ENV_KEY] = "sk_test_fake_key_for_unit_tests";

    const { getStripeClient } = await import("./client");

    const first = getStripeClient();
    const second = getStripeClient();

    expect(first).toBe(second);
  });
});
