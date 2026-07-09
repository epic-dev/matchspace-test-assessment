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

import { POST } from "../app/v1/checkout/route";

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
