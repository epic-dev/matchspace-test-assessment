import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { SupabaseBookingRepository } from "@/lib/bookings/supabase-repository";
import { logger } from "@/lib/logger";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";

/**
 * Stripe server-to-server webhook. Confirms bookings independently of
 * whether the paying student's browser makes it back to the app (see
 * stripe-checkout plan). Must read the *raw* body — `request.json()` would
 * consume/reformat it and break Stripe's signature verification, which is
 * computed over the exact bytes Stripe sent.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    if (!signature) {
      throw new Error("Missing stripe-signature header");
    }
    event = getStripeClient().webhooks.constructEvent(
      rawBody,
      signature,
      getStripeWebhookSecret(),
    );
  } catch (error) {
    // Never leak verification internals (they're not actionable for a
    // caller and could hint at the webhook secret) — log server-side only.
    logger.error("POST /v1/stripe/webhook signature verification failed", { error });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Stripe expects a 2xx for any event type we're not explicitly handling,
  // otherwise it will keep retrying delivery.
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) {
    // Nothing actionable without a bookingId — ack so Stripe doesn't retry.
    logger.error("checkout.session.completed event missing metadata.bookingId", {
      sessionId: session.id,
    });
    return NextResponse.json({ received: true }, { status: 200 });
  }

  try {
    const supabase = await createClient();
    const bookingRepository = new SupabaseBookingRepository(supabase);
    await bookingRepository.markPaid(bookingId);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    // A genuine failure here (e.g. DB unreachable) should surface as a
    // non-2xx so Stripe retries delivery, unlike other routes' generic 500 —
    // this is the one place where "fail loudly to the caller" is correct.
    logger.error("POST /v1/stripe/webhook failed to mark booking paid", { error, bookingId });
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}
