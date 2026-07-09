import { NextResponse } from "next/server";

import { bookingSchema } from "@/lib/bookings/booking-schema";
import { SupabaseBookingRepository } from "@/lib/bookings/supabase-repository";
import { logger } from "@/lib/logger";
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

  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const teacherRepository = new SupabaseTeacherRepository(supabase);
  const bookingRepository = new SupabaseBookingRepository(supabase);

  try {
    const teacher = await teacherRepository.getById(parsed.data.teacherId);
    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    const conflict = await bookingRepository.hasConflict(
      parsed.data.teacherId,
      parsed.data.dateTime,
      parsed.data.hours,
    );
    if (conflict) {
      return NextResponse.json(
        { error: "That time is no longer available" },
        { status: 409 },
      );
    }

    const booking = await bookingRepository.create(parsed.data);
    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    // RepositoryError and any unexpected error both return the same
    // generic 500 (no internals leaked to the client) — but every case
    // is logged server-side with its cause so a real failure is
    // diagnosable instead of vanishing into a 500 with no trace.
    logger.error("POST /v1/booking failed", { error });
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
