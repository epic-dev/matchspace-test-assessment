import Stripe from "stripe";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Server-only secret key used to construct the Stripe client. Never
 * `NEXT_PUBLIC_`-prefixed, never exposed to client code.
 */
export function getStripeSecretKey(): string {
  return requireEnv("STRIPE_SECRET_KEY");
}

/**
 * Signing secret used to verify that incoming `/v1/stripe/webhook` requests
 * really came from Stripe (`stripe.webhooks.constructEvent`). Same fail-loud
 * pattern as `getStripeSecretKey` — never falls back to a default.
 */
export function getStripeWebhookSecret(): string {
  return requireEnv("STRIPE_WEBHOOK_SECRET");
}

let stripeSingleton: Stripe | undefined;

/**
 * Lazily-constructed singleton Stripe client for server-only use (route
 * handlers / server actions). Fails loudly if `STRIPE_SECRET_KEY` is
 * missing, mirroring the pattern in `lib/supabase/env.ts`.
 */
export function getStripeClient(): Stripe {
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(getStripeSecretKey());
  }
  return stripeSingleton;
}
