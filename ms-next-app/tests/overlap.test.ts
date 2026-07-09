import { describe, expect, it } from "vitest";

import { intervalsOverlap } from "../utils/overlap";

function at(iso: string): Date {
  return new Date(iso);
}

describe("intervalsOverlap", () => {
  it("returns false when intervals don't overlap", () => {
    const result = intervalsOverlap(
      at("2026-07-08T10:00:00Z"),
      at("2026-07-08T11:00:00Z"),
      at("2026-07-08T13:00:00Z"),
      at("2026-07-08T14:00:00Z"),
    );
    expect(result).toBe(false);
  });

  it("returns true for an exact match", () => {
    const result = intervalsOverlap(
      at("2026-07-08T10:00:00Z"),
      at("2026-07-08T11:00:00Z"),
      at("2026-07-08T10:00:00Z"),
      at("2026-07-08T11:00:00Z"),
    );
    expect(result).toBe(true);
  });

  it("returns true for a partial overlap", () => {
    const result = intervalsOverlap(
      at("2026-07-08T10:00:00Z"),
      at("2026-07-08T11:00:00Z"),
      at("2026-07-08T10:30:00Z"),
      at("2026-07-08T11:30:00Z"),
    );
    expect(result).toBe(true);
  });

  it("returns false for adjacent slots (touching but not overlapping)", () => {
    const result = intervalsOverlap(
      at("2026-07-08T10:00:00Z"),
      at("2026-07-08T11:00:00Z"),
      at("2026-07-08T11:00:00Z"),
      at("2026-07-08T12:00:00Z"),
    );
    expect(result).toBe(false);
  });

  it("returns false for adjacent slots in reverse order", () => {
    const result = intervalsOverlap(
      at("2026-07-08T11:00:00Z"),
      at("2026-07-08T12:00:00Z"),
      at("2026-07-08T10:00:00Z"),
      at("2026-07-08T11:00:00Z"),
    );
    expect(result).toBe(false);
  });

  it("returns true when one interval fully contains the other", () => {
    const result = intervalsOverlap(
      at("2026-07-08T09:00:00Z"),
      at("2026-07-08T12:00:00Z"),
      at("2026-07-08T10:00:00Z"),
      at("2026-07-08T11:00:00Z"),
    );
    expect(result).toBe(true);
  });
});
