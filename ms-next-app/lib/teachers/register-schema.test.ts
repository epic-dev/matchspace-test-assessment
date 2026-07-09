import { describe, expect, it } from "vitest";

import { registerSchema } from "./register-schema";

const validPayload = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  password: "hunter22",
};

describe("registerSchema", () => {
  it("accepts a valid payload", () => {
    const result = registerSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const result = registerSchema.safeParse({
      email: validPayload.email,
      password: validPayload.password,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = registerSchema.safeParse({ ...validPayload, name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({ ...validPayload, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a short password", () => {
    const result = registerSchema.safeParse({ ...validPayload, password: "abc12" });
    expect(result.success).toBe(false);
  });
});
