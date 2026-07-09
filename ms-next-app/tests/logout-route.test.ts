import { beforeEach, describe, expect, it, vi } from "vitest";

const { signOutMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { signOut: signOutMock },
  }),
}));

import { POST } from "../app/v1/logout/route";

describe("POST /v1/logout", () => {
  beforeEach(() => {
    signOutMock.mockReset();
  });

  it("returns 200 on successful sign-out", async () => {
    signOutMock.mockResolvedValue({ error: null });

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns 500 when Supabase sign-out fails", async () => {
    signOutMock.mockResolvedValue({ error: { message: "network error" } });

    const response = await POST();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Failed to sign out" });
  });
});
