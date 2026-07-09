import { describe, expect, it, vi } from "vitest";

import { RepositoryError } from "./errors";
import { SupabaseBookingRepository } from "./supabase-repository";

const baseRow = {
  id: "booking-1",
  teacher_id: "teacher-1",
  date_time: "2026-08-01T10:00:00.000Z",
  hours: 1,
  location: null,
  is_online: null,
  student_name: "Ada Lovelace",
  student_email: "ada@example.com",
  message: null,
  status: "pending",
  created_at: "2026-07-09T00:00:00.000Z",
  stripe_session_id: null,
  payment_status: "pending",
};

function createMockSupabaseForGetById(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return { from, select, eq, maybeSingle };
}

describe("SupabaseBookingRepository.getById", () => {
  it("maps a found row, including stripeSessionId/paymentStatus", async () => {
    const { from, eq } = createMockSupabaseForGetById({
      data: {
        ...baseRow,
        stripe_session_id: "cs_test_123",
        payment_status: "paid",
      },
      error: null,
    });
    const supabase = { from };
    const repo = new SupabaseBookingRepository(supabase as never);

    const booking = await repo.getById("booking-1");

    expect(from).toHaveBeenCalledWith("bookings");
    expect(eq).toHaveBeenCalledWith("id", "booking-1");
    expect(booking).toEqual({
      id: "booking-1",
      teacherId: "teacher-1",
      dateTime: "2026-08-01T10:00:00.000Z",
      hours: 1,
      location: null,
      isOnline: null,
      studentName: "Ada Lovelace",
      studentEmail: "ada@example.com",
      message: null,
      status: "pending",
      createdAt: "2026-07-09T00:00:00.000Z",
      stripeSessionId: "cs_test_123",
      paymentStatus: "paid",
    });
  });

  it("returns null for a missing row (not an error)", async () => {
    const { from } = createMockSupabaseForGetById({ data: null, error: null });
    const supabase = { from };
    const repo = new SupabaseBookingRepository(supabase as never);

    await expect(repo.getById("missing")).resolves.toBeNull();
  });

  it("returns null for a malformed-id error instead of throwing", async () => {
    const { from } = createMockSupabaseForGetById({
      data: null,
      error: { message: "invalid input syntax for type uuid", code: "22P02" },
    });
    const supabase = { from };
    const repo = new SupabaseBookingRepository(supabase as never);

    await expect(repo.getById("not-a-uuid")).resolves.toBeNull();
  });

  it("throws RepositoryError on an unrelated query failure", async () => {
    const { from } = createMockSupabaseForGetById({
      data: null,
      error: { message: "permission denied for table bookings", code: "42501" },
    });
    const supabase = { from };
    const repo = new SupabaseBookingRepository(supabase as never);

    await expect(repo.getById("booking-1")).rejects.toBeInstanceOf(RepositoryError);
  });
});

function createMockSupabaseForUpdate(result: { error: unknown }) {
  const eq = vi.fn().mockResolvedValue(result);
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });

  return { from, update, eq };
}

describe("SupabaseBookingRepository.attachStripeSession", () => {
  it("updates stripe_session_id, scoped by id", async () => {
    const { from, update, eq } = createMockSupabaseForUpdate({ error: null });
    const supabase = { from };
    const repo = new SupabaseBookingRepository(supabase as never);

    await repo.attachStripeSession("booking-1", "cs_test_123");

    expect(from).toHaveBeenCalledWith("bookings");
    expect(update).toHaveBeenCalledWith({ stripe_session_id: "cs_test_123" });
    expect(eq).toHaveBeenCalledWith("id", "booking-1");
  });

  it("throws RepositoryError on a Supabase error", async () => {
    const { from } = createMockSupabaseForUpdate({
      error: { message: "permission denied for table bookings", code: "42501" },
    });
    const supabase = { from };
    const repo = new SupabaseBookingRepository(supabase as never);

    await expect(repo.attachStripeSession("booking-1", "cs_test_123")).rejects.toBeInstanceOf(
      RepositoryError,
    );
  });
});

describe("SupabaseBookingRepository.markPaid", () => {
  it("updates payment_status to paid, scoped by id", async () => {
    const { from, update, eq } = createMockSupabaseForUpdate({ error: null });
    const supabase = { from };
    const repo = new SupabaseBookingRepository(supabase as never);

    await repo.markPaid("booking-1");

    expect(from).toHaveBeenCalledWith("bookings");
    expect(update).toHaveBeenCalledWith({ payment_status: "paid" });
    expect(eq).toHaveBeenCalledWith("id", "booking-1");
  });

  it("throws RepositoryError on a Supabase error", async () => {
    const { from } = createMockSupabaseForUpdate({
      error: { message: "permission denied for table bookings", code: "42501" },
    });
    const supabase = { from };
    const repo = new SupabaseBookingRepository(supabase as never);

    await expect(repo.markPaid("booking-1")).rejects.toBeInstanceOf(RepositoryError);
  });

  it("does not throw when called a second time for an already-paid booking (zero-row-match update, no error)", async () => {
    // A redelivered webhook re-running `markPaid` for a booking that's
    // already `paid` matches zero rows on the underlying update, but
    // Supabase still reports no error in that case — this is what makes
    // the method idempotent.
    const { from } = createMockSupabaseForUpdate({ error: null });
    const supabase = { from };
    const repo = new SupabaseBookingRepository(supabase as never);

    await repo.markPaid("booking-1");
    await expect(repo.markPaid("booking-1")).resolves.toBeUndefined();
  });
});
