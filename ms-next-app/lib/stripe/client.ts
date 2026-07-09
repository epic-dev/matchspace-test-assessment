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
