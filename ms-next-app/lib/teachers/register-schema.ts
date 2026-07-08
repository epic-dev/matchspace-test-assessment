import { z } from "zod";

/**
 * Shared validation for `POST /v1/register` — used server-side by the route
 * handler and client-side by the registration form (Task 3) so both sides
 * agree on the rules without duplicating them.
 */
export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  hourlyPrice: z
    .number()
    .positive("Hourly price must be greater than 0")
    .optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
