/**
 * A booking request as persisted and returned to callers. `status` starts
 * at `"pending"` — nothing in this module transitions it to `"confirmed"`;
 * that's the payment flow's job (out of scope here, see the lesson-booking
 * plan). `paymentStatus` starts at `"pending"` and is flipped to `"paid"` by
 * the Stripe webhook once a checkout session completes (see the
 * stripe-checkout plan) — `stripeSessionId` is `null` until a checkout
 * session has been created for this booking.
 */
export type Booking = {
  id: string;
  teacherId: string;
  dateTime: string;
  hours: number;
  location: string | null;
  isOnline: boolean | null;
  studentName: string;
  studentEmail: string;
  message: string | null;
  status: string;
  createdAt: string;
  stripeSessionId: string | null;
  paymentStatus: string;
};

export type CreateBookingInput = {
  teacherId: string;
  dateTime: string;
  hours: number;
  location?: string;
  isOnline?: boolean;
  studentName: string;
  studentEmail: string;
  message?: string;
};

/**
 * Port for booking persistence and availability checks. `hasConflict` is a
 * separate method (rather than folded into `create`) so the route handler
 * can return a distinct 409 before attempting the insert.
 */
export interface BookingRepository {
  create(input: CreateBookingInput): Promise<Booking>;
  /**
   * True if the teacher already has a booking (of any status) overlapping
   * `[dateTime, dateTime + hours)`.
   */
  hasConflict(teacherId: string, dateTime: string, hours: number): Promise<boolean>;
  /** Returns `null` if no booking with `id` exists, rather than throwing. */
  getById(id: string): Promise<Booking | null>;
  /** Records the Stripe Checkout Session created for this booking. */
  attachStripeSession(id: string, sessionId: string): Promise<void>;
  /**
   * Marks the booking as paid. Must be safe to call more than once for the
   * same booking (Stripe can redeliver webhook events) — repeated calls are
   * a no-op past the first, not an error.
   */
  markPaid(id: string): Promise<void>;
}
