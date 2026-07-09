import { beforeEach, describe, expect, it, vi } from "vitest";

const getByIdMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockReturnValue({}),
}));
vi.mock("@/lib/teachers/teacher-supabase-repository", () => ({
  SupabaseTeacherRepository: vi.fn().mockImplementation(function MockRepository() {
    return { getById: getByIdMock };
  }),
}));

import { RepositoryError } from "@/lib/teachers/errors";

import { GET } from "../app/v1/teachers/[id]/route";

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /v1/teachers/[id]", () => {
  beforeEach(() => {
    getByIdMock.mockReset();
  });

  it("returns 200 with the teacher when found", async () => {
    const teacher = { id: "user-1", name: "Ada Lovelace" };
    getByIdMock.mockResolvedValue(teacher);

    const response = await GET(
      new Request("http://localhost/v1/teachers/user-1"),
      makeParams("user-1"),
    );

    expect(getByIdMock).toHaveBeenCalledWith("user-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(teacher);
  });

  it("returns 404 when the teacher does not exist", async () => {
    getByIdMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/v1/teachers/missing"),
      makeParams("missing"),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Teacher not found" });
  });

  it("returns 404 for a malformed id (repository maps it to null)", async () => {
    getByIdMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/v1/teachers/not-a-uuid"),
      makeParams("not-a-uuid"),
    );

    expect(response.status).toBe(404);
  });

  it("returns 500 when the repository throws", async () => {
    getByIdMock.mockRejectedValue(new RepositoryError("Failed to fetch teacher"));

    const response = await GET(
      new Request("http://localhost/v1/teachers/user-1"),
      makeParams("user-1"),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Failed to fetch teacher" });
  });
});
