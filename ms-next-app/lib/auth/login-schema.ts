import { z } from "zod";

/**
 * Shared validation for `POST /v1/login` — used server-side by the route
 * handler and client-side by `LoginForm` so both sides agree on the rules
 * without duplicating them (mirrors `registerSchema`'s split).
 */
export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
