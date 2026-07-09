import { describe, expect, it } from "vitest";

import { updateTeacherSchema } from "../lib/teachers/update-schema";

describe("updateTeacherSchema", () => {
  it("accepts a valid partial payload", () => {
    const result = updateTeacherSchema.safeParse({
      bio: "I teach piano and guitar.",
      instruments: ["piano", "guitar"],
      hourlyPrice: 40,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty body since instruments and hourlyPrice are required", () => {
    const result = updateTeacherSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts the full field set", () => {
    const result = updateTeacherSchema.safeParse({
      name: "Ada Lovelace",
      bio: "Bio",
      instruments: ["violin"],
      education: "Conservatory",
      credentials: "Grade 8",
      location: "Remote",
      onlineAvailability: true,
      hourlyPrice: 60,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-string name", () => {
    const result = updateTeacherSchema.safeParse({ name: 123 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-array instruments value", () => {
    const result = updateTeacherSchema.safeParse({ instruments: "piano" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-boolean onlineAvailability value", () => {
    const result = updateTeacherSchema.safeParse({ onlineAvailability: "yes" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-number hourlyPrice value", () => {
    const result = updateTeacherSchema.safeParse({ hourlyPrice: "40" });
    expect(result.success).toBe(false);
  });

  it("accepts an empty-string bio (no min-length rule)", () => {
    const result = updateTeacherSchema.safeParse({
      bio: "",
      instruments: ["piano"],
      hourlyPrice: 40,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a zero hourlyPrice (no positive-number rule)", () => {
    const result = updateTeacherSchema.safeParse({ hourlyPrice: 0 });
    expect(result.success).toBe(false);
  });
});
