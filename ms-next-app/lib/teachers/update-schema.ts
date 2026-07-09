import { z } from "zod";

/**
 * Shared validation for `PATCH /v1/teachers` — every field is optional per
 * the spec (a partial update to the *authenticated* teacher's own profile,
 * never targeted by id in the body). Per explicit instruction, fields carry
 * no business-rule constraints beyond their basic type/shape (no min-length,
 * no positive-number check) — only presence/type is validated. Used
 * server-side by the route handler and client-side by the `/profile` form
 * (Task 4) so both sides agree on the shape without duplicating it.
 */
export const updateTeacherSchema = z.object({
  bio: z.string().trim().optional(),
  instruments: z.array(z.string().trim()),
  education: z.string().trim().optional(),
  credentials: z.string().trim().optional(),
  location: z.string().trim().optional(),
  onlineAvailability: z.boolean().optional(),
  hourlyPrice: z.number(),
});

export type UpdateTeacherRequest = z.infer<typeof updateTeacherSchema>;
