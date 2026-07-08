import { describe, expect, it, vi } from "vitest";

import { DuplicateEmailError, RepositoryError, TeacherNotFoundError } from "./errors";
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

const baseTeacher = {
  bio: null,
  instruments: null,
  education: null,
  credentials: null,
  onlineAvailability: null,
};

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
    expect(teacher).toEqual({
      id: "user-1",
      name: "Ada Lovelace",
      hourlyPrice: 50,
      ...baseTeacher,
    });
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

function createMockSupabaseForUpdate(updateResult: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(updateResult);
  const select = vi.fn().mockReturnValue({ single });
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });

  return { from, update, eq, select, single };
}

describe("SupabaseTeacherRepository.updateOwnProfile", () => {
  it("updates only the provided fields, scoped to the caller's own row", async () => {
    const { from, update, eq } = createMockSupabaseForUpdate({
      data: {
        id: "user-1",
        name: "Ada Lovelace",
        hourly_price: 75,
        bio: "Piano teacher",
        instruments: "piano, violin",
        education: null,
        credentials: null,
        location: null,
        online_availability: true,
      },
      error: null,
    });
    const supabase = { from };
    const repo = new SupabaseTeacherRepository(supabase as never, {} as never);

    const teacher = await repo.updateOwnProfile("user-1", {
      bio: "Piano teacher",
      instruments: ["piano", "violin"],
      onlineAvailability: true,
      hourlyPrice: 75,
    });

    expect(from).toHaveBeenCalledWith("teachers");
    expect(update).toHaveBeenCalledWith({
      bio: "Piano teacher",
      instruments: "piano, violin",
      online_availability: true,
      hourly_price: 75,
    });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
    expect(teacher).toEqual({
      id: "user-1",
      name: "Ada Lovelace",
      hourlyPrice: 75,
      bio: "Piano teacher",
      instruments: ["piano", "violin"],
      education: null,
      credentials: null,
      onlineAvailability: true,
    });
  });

  it("maps a 'no rows found' update error to TeacherNotFoundError", async () => {
    const { from } = createMockSupabaseForUpdate({
      data: null,
      error: { message: "Results contain 0 rows", code: "PGRST116" },
    });
    const supabase = { from };
    const repo = new SupabaseTeacherRepository(supabase as never, {} as never);

    await expect(repo.updateOwnProfile("missing-user", { bio: "Hi" })).rejects.toBeInstanceOf(
      TeacherNotFoundError,
    );
  });

  it("maps an unrelated update failure to RepositoryError", async () => {
    const { from } = createMockSupabaseForUpdate({
      data: null,
      error: { message: "permission denied for table teachers", code: "42501" },
    });
    const supabase = { from };
    const repo = new SupabaseTeacherRepository(supabase as never, {} as never);

    await expect(repo.updateOwnProfile("user-1", { bio: "Hi" })).rejects.toBeInstanceOf(
      RepositoryError,
    );
  });
});

function createMockSupabaseForList(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ order });
  const from = vi.fn().mockReturnValue({ select });

  return { from, select, order };
}

describe("SupabaseTeacherRepository.list", () => {
  it("maps multiple rows, ordered by name", async () => {
    const { from, order } = createMockSupabaseForList({
      data: [
        {
          id: "user-1",
          name: "Ada Lovelace",
          hourly_price: 50,
          bio: null,
          instruments: "piano, violin",
          education: null,
          credentials: null,
          location: null,
          online_availability: null,
        },
        {
          id: "user-2",
          name: "Bo Diddley",
          hourly_price: null,
          bio: null,
          instruments: null,
          education: null,
          credentials: null,
          location: null,
          online_availability: null,
        },
      ],
      error: null,
    });
    const supabase = { from };
    const repo = new SupabaseTeacherRepository(supabase as never, {} as never);

    const teachers = await repo.list();

    expect(from).toHaveBeenCalledWith("teachers");
    expect(order).toHaveBeenCalledWith("name");
    expect(teachers).toEqual([
      {
        id: "user-1",
        name: "Ada Lovelace",
        hourlyPrice: 50,
        bio: null,
        instruments: ["piano", "violin"],
        education: null,
        credentials: null,
        onlineAvailability: null,
      },
      {
        id: "user-2",
        name: "Bo Diddley",
        hourlyPrice: null,
        ...baseTeacher,
      },
    ]);
  });

  it("returns an empty array for an empty result set", async () => {
    const { from } = createMockSupabaseForList({ data: [], error: null });
    const supabase = { from };
    const repo = new SupabaseTeacherRepository(supabase as never, {} as never);

    await expect(repo.list()).resolves.toEqual([]);
  });

  it("throws RepositoryError on a query failure", async () => {
    const { from } = createMockSupabaseForList({
      data: null,
      error: { message: "connection error", code: "08000" },
    });
    const supabase = { from };
    const repo = new SupabaseTeacherRepository(supabase as never, {} as never);

    await expect(repo.list()).rejects.toBeInstanceOf(RepositoryError);
  });
});

function createMockSupabaseForGetById(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return { from, select, eq, maybeSingle };
}

describe("SupabaseTeacherRepository.getById", () => {
  it("maps a found row", async () => {
    const { from, eq } = createMockSupabaseForGetById({
      data: {
        id: "user-1",
        name: "Ada Lovelace",
        hourly_price: 50,
        bio: null,
        instruments: null,
        education: null,
        credentials: null,
        location: null,
        online_availability: null,
      },
      error: null,
    });
    const supabase = { from };
    const repo = new SupabaseTeacherRepository(supabase as never, {} as never);

    const teacher = await repo.getById("user-1");

    expect(from).toHaveBeenCalledWith("teachers");
    expect(eq).toHaveBeenCalledWith("id", "user-1");
    expect(teacher).toEqual({
      id: "user-1",
      name: "Ada Lovelace",
      hourlyPrice: 50,
      ...baseTeacher,
    });
  });

  it("returns null for a missing row", async () => {
    const { from } = createMockSupabaseForGetById({ data: null, error: null });
    const supabase = { from };
    const repo = new SupabaseTeacherRepository(supabase as never, {} as never);

    await expect(repo.getById("missing")).resolves.toBeNull();
  });

  it("returns null for a malformed-id error instead of throwing", async () => {
    const { from } = createMockSupabaseForGetById({
      data: null,
      error: { message: "invalid input syntax for type uuid", code: "22P02" },
    });
    const supabase = { from };
    const repo = new SupabaseTeacherRepository(supabase as never, {} as never);

    await expect(repo.getById("not-a-uuid")).resolves.toBeNull();
  });

  it("throws RepositoryError on an unrelated query failure", async () => {
    const { from } = createMockSupabaseForGetById({
      data: null,
      error: { message: "permission denied for table teachers", code: "42501" },
    });
    const supabase = { from };
    const repo = new SupabaseTeacherRepository(supabase as never, {} as never);

    await expect(repo.getById("user-1")).rejects.toBeInstanceOf(RepositoryError);
  });
});
