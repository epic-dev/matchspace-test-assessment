import { beforeEach, describe, expect, it, vi } from "vitest";

const listMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockReturnValue({}),
}));
vi.mock("@/lib/teachers/supabase-repository", () => ({
  SupabaseTeacherRepository: vi.fn().mockImplementation(function MockRepository() {
    return { list: listMock };
  }),
}));

import { RepositoryError } from "@/lib/teachers/errors";

import { GET } from "./route";

describe("GET /v1/teachers", () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it("returns 200 with the teacher list", async () => {
    const teachers = [
      { id: "user-1", name: "Ada Lovelace", instruments: ["piano"] },
      { id: "user-2", name: "Bo Diddley", instruments: null },
    ];
    listMock.mockResolvedValue(teachers);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(teachers);
  });

  it("returns 200 with an empty array when there are no teachers", async () => {
    listMock.mockResolvedValue([]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
  });

  it("returns 500 when the repository throws", async () => {
    listMock.mockRejectedValue(new RepositoryError("Failed to list teachers"));

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Failed to list teachers" });
  });
});
