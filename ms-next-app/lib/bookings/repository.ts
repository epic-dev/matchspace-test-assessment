/**
 * A booking request as persisted and returned to callers. `status` starts
 * at `"pending"` — nothing in this module transitions it to `"confirmed"`;
 * that's the payment flow's job (out of scope here, see the lesson-booking
 * plan).
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
}
