import { NextResponse } from "next/server";

import { checkoutSchema } from "@/lib/bookings/checkout-schema";
import { SupabaseBookingRepository } from "@/lib/bookings/supabase-repository";
import { logger } from "@/lib/logger";
import { getStripeClient } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { SupabaseTeacherRepository } from "@/lib/teachers/supabase-repository";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const bookingRepository = new SupabaseBookingRepository(supabase);
  const teacherRepository = new SupabaseTeacherRepository(supabase);

  try {
    const booking = await bookingRepository.getById(parsed.data.bookingId);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const teacher = await teacherRepository.getById(booking.teacherId);
    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    if (teacher.hourlyPrice === null) {
      return NextResponse.json(
        { error: "This teacher has not set an hourly price yet" },
        { status: 422 },
      );
    }

    // Stripe's `unit_amount` is an integer number of the smallest currency
    // unit (cents for EUR) — round rather than truncate so e.g. a
    // hourlyPrice/hours combination that lands on a fraction of a cent isn't
    // silently under-charged.
    const unitAmount = Math.round(booking.hours * teacher.hourlyPrice);
    const origin = new URL(request.url).origin;

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "eur",
              unit_amount: unitAmount,
              product_data: {
                name: `Lesson with ${teacher.name} (${booking.hours}h)`,
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/booking/success`,
        cancel_url: `${origin}/booking/cancel`,
        metadata: { bookingId: booking.id },
      },
      // Deterministic, booking-scoped idempotency key: a retried checkout
      // call for the same booking (auto-trigger followed by a manual retry,
      // or any other duplicate) reuses the same Stripe Checkout Session
      // instead of minting a second live one.
      { idempotencyKey: `checkout-session:${booking.id}` },
    );

    await bookingRepository.attachStripeSession(booking.id, session.id);

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    // RepositoryError and any Stripe/unexpected error both return the same
    // generic 500 (no internals leaked to the client) — but every case is
    // logged server-side with its cause so a real failure is diagnosable
    // instead of vanishing into a 500 with no trace.
    logger.error("POST /v1/checkout failed", { error });
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
