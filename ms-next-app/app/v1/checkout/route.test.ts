import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getBookingByIdMock,
  attachStripeSessionMock,
  getTeacherByIdMock,
  checkoutSessionsCreateMock,
} = vi.hoisted(() => ({
  getBookingByIdMock: vi.fn(),
  attachStripeSessionMock: vi.fn(),
  getTeacherByIdMock: vi.fn(),
  checkoutSessionsCreateMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockReturnValue({}),
}));
vi.mock("@/lib/bookings/supabase-repository", () => ({
  SupabaseBookingRepository: vi.fn().mockImplementation(function MockBookingRepository() {
    return {
      getById: getBookingByIdMock,
      attachStripeSession: attachStripeSessionMock,
    };
  }),
}));
vi.mock("@/lib/teachers/supabase-repository", () => ({
  SupabaseTeacherRepository: vi.fn().mockImplementation(function MockTeacherRepository() {
    return { getById: getTeacherByIdMock };
  }),
}));
vi.mock("@/lib/stripe/client", () => ({
  getStripeClient: vi.fn().mockReturnValue({
    checkout: { sessions: { create: checkoutSessionsCreateMock } },
  }),
}));

import { POST } from "./route";

const booking = {
  id: "11111111-1111-4111-8111-111111111111",
  teacherId: "22222222-2222-4222-8222-222222222222",
  dateTime: "2026-07-10T10:00:00Z",
  hours: 2,
  location: null,
  isOnline: true,
  studentName: "Jane Student",
  studentEmail: "jane@example.com",
  message: null,
  status: "pending",
  createdAt: "2026-07-08T00:00:00Z",
  stripeSessionId: null,
  paymentStatus: "pending",
};

const teacher = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Ada Lovelace",
  bio: null,
  instruments: ["piano"],
  education: null,
  credentials: null,
  onlineAvailability: true,
  hourlyPrice: 30,
};

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/v1/checkout", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /v1/checkout", () => {
  beforeEach(() => {
    getBookingByIdMock.mockReset();
    attachStripeSessionMock.mockReset();
    getTeacherByIdMock.mockReset();
    checkoutSessionsCreateMock.mockReset();
  });

  it("returns 200 with the checkout url for a valid booking and priced teacher", async () => {
    getBookingByIdMock.mockResolvedValue(booking);
    getTeacherByIdMock.mockResolvedValue(teacher);
    checkoutSessionsCreateMock.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/pay/cs_test_123",
    });

    const response = await POST(makeRequest({ bookingId: booking.id }));

    expect(getBookingByIdMock).toHaveBeenCalledWith(booking.id);
    expect(getTeacherByIdMock).toHaveBeenCalledWith(booking.teacherId);
    expect(checkoutSessionsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        success_url: "http://localhost:3000/booking/success",
        cancel_url: "http://localhost:3000/booking/cancel",
        metadata: { bookingId: booking.id },
        line_items: [
          expect.objectContaining({
            quantity: 1,
            price_data: expect.objectContaining({
              currency: "eur",
              unit_amount: 6000,
            }),
          }),
        ],
      }),
    );
    expect(attachStripeSessionMock).toHaveBeenCalledWith(booking.id, "cs_test_123");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://checkout.stripe.com/pay/cs_test_123",
    });
  });

  it("returns 404 when the booking does not exist", async () => {
    getBookingByIdMock.mockResolvedValue(null);

    const response = await POST(makeRequest({ bookingId: booking.id }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Booking not found" });
    expect(checkoutSessionsCreateMock).not.toHaveBeenCalled();
  });

  it("returns 422 when the teacher has no hourly price set", async () => {
    getBookingByIdMock.mockResolvedValue(booking);
    getTeacherByIdMock.mockResolvedValue({ ...teacher, hourlyPrice: null });

    const response = await POST(makeRequest({ bookingId: booking.id }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "This teacher has not set an hourly price yet",
    });
    expect(checkoutSessionsCreateMock).not.toHaveBeenCalled();
  });

  it("returns 500 when the Stripe API call fails", async () => {
    getBookingByIdMock.mockResolvedValue(booking);
    getTeacherByIdMock.mockResolvedValue(teacher);
    checkoutSessionsCreateMock.mockRejectedValue(new Error("Stripe is down"));

    const response = await POST(makeRequest({ bookingId: booking.id }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to create checkout session",
    });
    expect(attachStripeSessionMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid bookingId", async () => {
    const response = await POST(makeRequest({ bookingId: "not-a-uuid" }));

    expect(response.status).toBe(400);
    expect(getBookingByIdMock).not.toHaveBeenCalled();
  });
});
