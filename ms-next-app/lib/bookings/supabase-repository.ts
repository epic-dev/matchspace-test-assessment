import type { SupabaseClient } from "@supabase/supabase-js";

import { RepositoryError } from "./errors";
import { intervalsOverlap } from "../../utils/overlap";
import type { Booking, BookingRepository, CreateBookingInput } from "./repository";

/** Postgres "invalid text representation" code — e.g. a malformed UUID passed to `.eq("id", ...)`. */
const POSTGRES_INVALID_INPUT = "22P02";

/**
 * `bookings` table, created by hand (no migration file in this repo — see
 * the lesson-booking plan's assumptions), matching the `teachers` table's
 * pattern:
 *
 * ```sql
 * create table bookings (
 *   id uuid primary key default gen_random_uuid(),
 *   teacher_id uuid not null references teachers(id),
 *   date_time timestamptz not null,
 *   hours numeric not null default 1,
 *   location text,
 *   is_online boolean,
 *   student_name text not null,
 *   student_email text not null,
 *   message text,
 *   status text not null default 'pending',
 *   created_at timestamptz not null default now()
 * );
 * ```
 *
 * `stripe_session_id`/`payment_status` (below) were added by hand after the
 * table above already existed in the real Supabase project, via (stripe-checkout
 * plan, Task 2 — this DDL has NOT been run against the live project from this
 * sandbox; it still needs to be applied by hand, same as the table above was):
 *
 * ```sql
 * alter table bookings add column stripe_session_id text;
 * alter table bookings add column payment_status text not null default 'pending';
 * ```
 */
type BookingRow = {
  id: string;
  teacher_id: string;
  date_time: string;
  hours: number;
  location: string | null;
  is_online: boolean | null;
  student_name: string;
  student_email: string;
  message: string | null;
  status: string;
  created_at: string;
  stripe_session_id: string | null;
  payment_status: string;
};

export class SupabaseBookingRepository implements BookingRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(input: CreateBookingInput): Promise<Booking> {
    const { data, error } = await this.supabase
      .from("bookings")
      .insert({
        teacher_id: input.teacherId,
        date_time: input.dateTime,
        hours: input.hours,
        location: input.location ?? null,
        is_online: input.isOnline ?? null,
        student_name: input.studentName,
        student_email: input.studentEmail,
        message: input.message ?? null,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      throw new RepositoryError("Failed to create booking", { cause: error });
    }

    return mapRow(data as BookingRow);
  }

  async hasConflict(teacherId: string, dateTime: string, hours: number): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("bookings")
      .select("date_time, hours")
      .eq("teacher_id", teacherId);

    if (error) {
      throw new RepositoryError("Failed to check booking availability", { cause: error });
    }

    const requestedStart = new Date(dateTime);
    const requestedEnd = addHours(requestedStart, hours);

    const rows = (data ?? []) as Pick<BookingRow, "date_time" | "hours">[];
    return rows.some((row) => {
      const existingStart = new Date(row.date_time);
      const existingEnd = addHours(existingStart, row.hours);
      return intervalsOverlap(requestedStart, requestedEnd, existingStart, existingEnd);
    });
  }

  async getById(id: string): Promise<Booking | null> {
    const { data, error } = await this.supabase
      .from("bookings")
      .select()
      .eq("id", id)
      .maybeSingle();

    if (error) {
      if (isInvalidInput(error)) {
        // A malformed id (e.g. not a UUID) can never match a row — treat
        // it the same as not-found rather than a 500.
        return null;
      }
      throw new RepositoryError("Failed to fetch booking", { cause: error });
    }

    return data ? mapRow(data as BookingRow) : null;
  }

  async attachStripeSession(id: string, sessionId: string): Promise<void> {
    const { error } = await this.supabase
      .from("bookings")
      .update({ stripe_session_id: sessionId })
      .eq("id", id);

    if (error) {
      throw new RepositoryError("Failed to attach Stripe session to booking", { cause: error });
    }
  }

  async markPaid(id: string): Promise<void> {
    // No `.select().single()` here on purpose: an update that matches zero
    // rows (e.g. a redelivered webhook for an already-paid booking that
    // itself no longer changes the row) still succeeds with no error,
    // which is what makes this safe to call more than once.
    const { error } = await this.supabase
      .from("bookings")
      .update({ payment_status: "paid" })
      .eq("id", id);

    if (error) {
      throw new RepositoryError("Failed to mark booking as paid", { cause: error });
    }
  }
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function isInvalidInput(error: { code?: string }): boolean {
  return error.code === POSTGRES_INVALID_INPUT;
}

function mapRow(row: BookingRow): Booking {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    dateTime: row.date_time,
    hours: row.hours,
    location: row.location ?? null,
    isOnline: row.is_online ?? null,
    studentName: row.student_name,
    studentEmail: row.student_email,
    message: row.message ?? null,
    status: row.status,
    createdAt: row.created_at,
    stripeSessionId: row.stripe_session_id ?? null,
    paymentStatus: row.payment_status ?? "pending",
  };
}
