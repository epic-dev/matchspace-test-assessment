import { beforeEach, describe, expect, it, vi } from "vitest";

const { constructEventMock, markPaidMock } = vi.hoisted(() => ({
  constructEventMock: vi.fn(),
  markPaidMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockReturnValue({}),
}));
vi.mock("@/lib/bookings/supabase-repository", () => ({
  SupabaseBookingRepository: vi.fn().mockImplementation(function MockBookingRepository() {
    return { markPaid: markPaidMock };
  }),
}));
vi.mock("@/lib/stripe/client", () => ({
  getStripeClient: vi.fn().mockReturnValue({
    webhooks: { constructEvent: constructEventMock },
  }),
  getStripeWebhookSecret: vi.fn().mockReturnValue("whsec_test_fake"),
}));

import { POST } from "./route";

const bookingId = "11111111-1111-4111-8111-111111111111";

function makeRequest(body: string, headers: Record<string, string> = { "stripe-signature": "t=1,v1=fake" }) {
  return new Request("http://localhost:3000/v1/stripe/webhook", {
    method: "POST",
    body,
    headers,
  });
}

function checkoutSessionCompletedEvent(overrides: Partial<{ metadata: Record<string, string> | null }> = {}) {
  return {
    id: "evt_test_123",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_123",
        object: "checkout.session",
        metadata: overrides.metadata === undefined ? { bookingId } : overrides.metadata,
      },
    },
  };
}

describe("POST /v1/stripe/webhook", () => {
  beforeEach(() => {
    constructEventMock.mockReset();
    markPaidMock.mockReset();
  });

  it("marks the booking paid for a valid signed checkout.session.completed event", async () => {
    const event = checkoutSessionCompletedEvent();
    constructEventMock.mockReturnValue(event);
    markPaidMock.mockResolvedValue(undefined);

    const response = await POST(makeRequest(JSON.stringify(event)));

    expect(constructEventMock).toHaveBeenCalledWith(
      JSON.stringify(event),
      "t=1,v1=fake",
      "whsec_test_fake",
    );
    expect(markPaidMock).toHaveBeenCalledWith(bookingId);
    expect(response.status).toBe(200);
  });

  it("returns 400 and does not mark anything paid when signature verification fails", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("Invalid signature for this webhook secret");
    });

    const response = await POST(makeRequest(JSON.stringify(checkoutSessionCompletedEvent())));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid signature" });
    expect(markPaidMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the stripe-signature header is missing", async () => {
    const response = await POST(
      makeRequest(JSON.stringify(checkoutSessionCompletedEvent()), {}),
    );

    expect(response.status).toBe(400);
    expect(constructEventMock).not.toHaveBeenCalled();
    expect(markPaidMock).not.toHaveBeenCalled();
  });

  it("returns 200 and does not call markPaid for an unhandled event type", async () => {
    const event = { id: "evt_test_456", type: "payment_intent.succeeded", data: { object: {} } };
    constructEventMock.mockReturnValue(event);

    const response = await POST(makeRequest(JSON.stringify(event)));

    expect(response.status).toBe(200);
    expect(markPaidMock).not.toHaveBeenCalled();
  });

  it("returns 200 without error for a redelivered event for an already-paid booking", async () => {
    const event = checkoutSessionCompletedEvent();
    constructEventMock.mockReturnValue(event);
    // markPaid is idempotent — a no-op update for an already-paid booking
    // still resolves without throwing (see supabase-repository.ts).
    markPaidMock.mockResolvedValue(undefined);

    const response = await POST(makeRequest(JSON.stringify(event)));
    const secondResponse = await POST(makeRequest(JSON.stringify(event)));

    expect(response.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(markPaidMock).toHaveBeenCalledTimes(2);
    expect(markPaidMock).toHaveBeenCalledWith(bookingId);
  });

  it("returns 200 and does not call markPaid when metadata.bookingId is missing", async () => {
    const event = checkoutSessionCompletedEvent({ metadata: null });
    constructEventMock.mockReturnValue(event);

    const response = await POST(makeRequest(JSON.stringify(event)));

    expect(response.status).toBe(200);
    expect(markPaidMock).not.toHaveBeenCalled();
  });

  it("returns 500 when markPaid throws (surfaces so Stripe retries delivery)", async () => {
    const event = checkoutSessionCompletedEvent();
    constructEventMock.mockReturnValue(event);
    markPaidMock.mockRejectedValue(new Error("DB unreachable"));

    const response = await POST(makeRequest(JSON.stringify(event)));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Failed to process webhook" });
  });
});
