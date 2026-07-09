import { z } from "zod";

/**
 * Validation for `POST /v1/checkout`'s request body. `bookingId` is the only
 * input the client supplies — everything used to price the Stripe Checkout
 * Session (booking hours, teacher hourly price) is looked up server-side,
 * never trusted from the request.
 */
export const checkoutSchema = z.object({
  bookingId: z.uuid("bookingId must be a valid UUID"),
});

export type CheckoutRequest = z.infer<typeof checkoutSchema>;
