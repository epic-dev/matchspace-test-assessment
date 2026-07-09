import { z } from "zod";

/**
 * Shared validation for `POST /v1/booking` — used server-side by the route
 * handler and (Task 3) client-side by the teacher-detail booking form, so
 * both sides agree on the shape without duplicating it.
 *
 * `dateTime` accepts both a bare local datetime (e.g. what an
 * `<input type="datetime-local">` produces, `"2026-07-08T10:00"`) and a
 * fully-qualified ISO string with an offset/`Z` — no timezone conversion is
 * applied anywhere in this plan (see plan's open questions).
 */
export const bookingSchema = z
  .object({
    teacherId: z.uuid("teacherId must be a valid UUID"),
    dateTime: z.iso.datetime({
      local: true,
      offset: true,
      error: "dateTime must be a valid ISO datetime string",
    }),
    hours: z.number().positive("hours must be greater than 0").optional().default(1),
    location: z.string().trim().min(1).optional(),
    isOnline: z.boolean().optional(),
    studentName: z.string().trim().min(1, "Student name is required"),
    studentEmail: z.email("Enter a valid email address"),
    message: z.string().trim().optional(),
  })
  .refine((data) => data.location !== undefined || data.isOnline !== undefined, {
    message: "Provide a location or set isOnline",
    path: ["location"],
  });

export type BookingRequest = z.infer<typeof bookingSchema>;
