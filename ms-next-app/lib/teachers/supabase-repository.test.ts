import { describe, expect, it, vi } from "vitest";

import { DuplicateEmailError, RepositoryError } from "./errors";
import { SupabaseTeacherRepository } from "./supabase-repository";

type MockSupabase = {
  auth: { signUp: ReturnType<typeof vi.fn> };
  from: ReturnType<typeof vi.fn>;
};

type MockAdminClient = {
  auth: { admin: { deleteUser: ReturnType<typeof vi.fn> } };
};

function createMockSupabase(overrides?: {
  signUp?: { data: unknown; error: unknown };
  insertResult?: { data: unknown; error: unknown };
}): MockSupabase {
  const signUp = vi.fn().mockResolvedValue(
    overrides?.signUp ?? {
      data: { user: { id: "user-1" } },
      error: null,
    },
  );

  const single = vi.fn().mockResolvedValue(
    overrides?.insertResult ?? {
      data: { id: "user-1", name: "Ada Lovelace", hourly_price: 50 },
      error: null,
    },
  );
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });

  return { auth: { signUp }, from };
}

function createMockAdminClient(overrides?: {
  deleteUser?: { error: unknown };
}): MockAdminClient {
  const deleteUser = vi.fn().mockResolvedValue(overrides?.deleteUser ?? { error: null });
  return { auth: { admin: { deleteUser } } };
}

const input = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  password: "hunter22",
  hourlyPrice: 50,
};

describe("SupabaseTeacherRepository.register", () => {
  it("calls signUp with the right args and inserts the mapped row", async () => {
    const supabase = createMockSupabase();
    const adminClient = createMockAdminClient();
    const repo = new SupabaseTeacherRepository(supabase as never, adminClient as never);

    const teacher = await repo.register(input);

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: input.email,
      password: input.password,
    });
    expect(supabase.from).toHaveBeenCalledWith("teachers");
    const insertMock = supabase.from.mock.results[0].value.insert as ReturnType<typeof vi.fn>;
    expect(insertMock).toHaveBeenCalledWith({
      id: "user-1",
      name: input.name,
      hourly_price: input.hourlyPrice,
    });
    expect(teacher).toEqual({ id: "user-1", name: "Ada Lovelace", hourlyPrice: 50 });
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("maps a duplicate-email signUp error to DuplicateEmailError", async () => {
    const supabase = createMockSupabase({
      signUp: {
        data: { user: null },
        error: { message: "User already registered", code: "user_already_exists" },
      },
    });
    const adminClient = createMockAdminClient();
    const repo = new SupabaseTeacherRepository(supabase as never, adminClient as never);

    await expect(repo.register(input)).rejects.toBeInstanceOf(DuplicateEmailError);
  });

  it("maps a unique-violation insert error to DuplicateEmailError without compensating", async () => {
    const supabase = createMockSupabase({
      insertResult: {
        data: null,
        error: { message: "duplicate key value violates unique constraint", code: "23505" },
      },
    });
    const adminClient = createMockAdminClient();
    const repo = new SupabaseTeacherRepository(supabase as never, adminClient as never);

    await expect(repo.register(input)).rejects.toBeInstanceOf(DuplicateEmailError);
    // A unique-violation means the teachers row already exists (e.g. a
    // retried request) — the auth user isn't orphaned, so there's nothing
    // to compensate.
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("maps an unrelated signUp failure to RepositoryError", async () => {
    const supabase = createMockSupabase({
      signUp: {
        data: { user: null },
        error: { message: "Network error", code: "unexpected_failure" },
      },
    });
    const adminClient = createMockAdminClient();
    const repo = new SupabaseTeacherRepository(supabase as never, adminClient as never);

    await expect(repo.register(input)).rejects.toBeInstanceOf(RepositoryError);
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("maps an unrelated insert failure to RepositoryError and compensates by deleting the orphaned auth user", async () => {
    const supabase = createMockSupabase({
      insertResult: {
        data: null,
        error: { message: "permission denied for table teachers", code: "42501" },
      },
    });
    const adminClient = createMockAdminClient();
    const repo = new SupabaseTeacherRepository(supabase as never, adminClient as never);

    await expect(repo.register(input)).rejects.toBeInstanceOf(RepositoryError);
    expect(adminClient.auth.admin.deleteUser).toHaveBeenCalledWith("user-1");
  });
});
