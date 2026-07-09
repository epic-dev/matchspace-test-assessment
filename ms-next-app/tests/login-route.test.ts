import { beforeEach, describe, expect, it, vi } from "vitest";

const { signInWithPasswordMock } = vi.hoisted(() => ({
  signInWithPasswordMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { signInWithPassword: signInWithPasswordMock },
  }),
}));

import { POST } from "../app/v1/login/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/v1/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /v1/login", () => {
  beforeEach(() => {
    signInWithPasswordMock.mockReset();
  });

  it("returns 200 with the user on successful sign-in", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "ada@example.com" } },
      error: null,
    });

    const response = await POST(
      makeRequest({ email: "ada@example.com", password: "correct-horse" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: { id: "user-1", email: "ada@example.com" },
    });
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "correct-horse",
    });
  });

  it("returns 401 with a generic message on wrong credentials", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    const response = await POST(
      makeRequest({ email: "ada@example.com", password: "wrong" }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid email or password",
    });
  });

  it("returns 400 for an invalid email without calling Supabase", async () => {
    const response = await POST(
      makeRequest({ email: "not-an-email", password: "whatever" }),
    );

    expect(response.status).toBe(400);
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a missing password without calling Supabase", async () => {
    const response = await POST(makeRequest({ email: "ada@example.com", password: "" }));

    expect(response.status).toBe(400);
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });
});
