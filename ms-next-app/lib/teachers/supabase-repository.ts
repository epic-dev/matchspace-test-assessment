import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";

import { DuplicateEmailError, RepositoryError, TeacherNotFoundError } from "./errors";
import type {
  RegisterTeacherInput,
  Teacher,
  TeacherRepository,
  UpdateTeacherInput,
} from "./repository";

/** Postgres unique_violation error code. */
const POSTGRES_UNIQUE_VIOLATION = "23505";

/** PostgREST "no rows found" code, returned by `.single()` when 0 rows match. */
const POSTGREST_NO_ROWS = "PGRST116";

/** Postgres "invalid text representation" code — e.g. a malformed UUID passed to `.eq("id", ...)`. */
const POSTGRES_INVALID_INPUT = "22P02";

/** GoTrue error codes seen for a duplicate-email signUp, across API versions. */
const DUPLICATE_EMAIL_AUTH_CODES = new Set([
  "user_already_exists",
  "email_exists",
  "identity_already_exists",
]);

type TeacherRow = {
  id: string;
  name: string;
  hourly_price: number | null;
  bio: string | null;
  instruments: string | null;
  education: string | null;
  credentials: string | null;
  location: string | null;
  online_availability: boolean | null;
};

export class SupabaseTeacherRepository implements TeacherRepository {
  /**
   * @param supabase Cookie-based, session-scoped client — used for the
   *   actual signUp + insert/update so RLS applies as the calling user.
   * @param adminClient Service-role client — used ONLY to compensate
   *   (delete the auth user) if the `teachers` insert fails after signUp
   *   already succeeded. Never used for the primary write path.
   */
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly adminClient: SupabaseClient,
  ) {}

  async register(input: RegisterTeacherInput): Promise<Teacher> {
    const { name, email, password, hourlyPrice } = input;

    const { data: signUpData, error: signUpError } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      if (isDuplicateEmailAuthError(signUpError)) {
        throw new DuplicateEmailError(email);
      }
      throw new RepositoryError("Failed to create auth user", { cause: signUpError });
    }

    const user = signUpData.user;
    if (!user) {
      throw new RepositoryError("signUp did not return a user");
    }

    const { data: teacherRow, error: insertError } = await this.supabase
      .from("teachers")
      .insert({
        id: user.id,
        name,
        hourly_price: hourlyPrice ?? null,
      })
      .select()
      .single();

    if (insertError) {
      if (isUniqueViolation(insertError)) {
        throw new DuplicateEmailError(email);
      }
      // The auth user from signUp() above now exists with no matching
      // teachers row. Left alone, that email is permanently stuck: any
      // retry hits signUp's duplicate-email path forever. Delete the
      // orphaned auth user so the email becomes available again.
      await this.compensateOrphanedAuthUser(user.id, insertError);
      throw new RepositoryError("Failed to create teacher profile", { cause: insertError });
    }

    return mapRow(teacherRow as TeacherRow);
  }

  async updateOwnProfile(userId: string, input: UpdateTeacherInput): Promise<Teacher> {
    const patch = buildUpdatePatch(input);

    const { data, error } = await this.supabase
      .from("teachers")
      .update(patch)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      if (isNoRowsFound(error)) {
        throw new TeacherNotFoundError(userId);
      }
      throw new RepositoryError("Failed to update teacher profile", { cause: error });
    }

    return mapRow(data as TeacherRow);
  }

  async list(): Promise<Teacher[]> {
    const { data, error } = await this.supabase.from("teachers").select().order("name");

    if (error) {
      throw new RepositoryError("Failed to list teachers", { cause: error });
    }

    return (data as TeacherRow[]).map(mapRow);
  }

  async getById(id: string): Promise<Teacher | null> {
    const { data, error } = await this.supabase
      .from("teachers")
      .select()
      .eq("id", id)
      .maybeSingle();

    if (error) {
      if (isInvalidInput(error)) {
        // A malformed id (e.g. not a UUID) can never match a row — treat
        // it the same as not-found rather than a 500.
        return null;
      }
      throw new RepositoryError("Failed to fetch teacher", { cause: error });
    }

    return data ? mapRow(data as TeacherRow) : null;
  }

  private async compensateOrphanedAuthUser(userId: string, insertError: unknown): Promise<void> {
    const { error: deleteError } = await this.adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      // Compensation itself failed — the email is now genuinely stuck.
      // This must be loud: it's the one failure mode that needs a human.
      logger.error("Failed to compensate orphaned auth user after teachers insert failure", {
        userId,
        insertError,
        deleteError,
      });
    }
  }
}

function isDuplicateEmailAuthError(error: { message?: string; code?: string }): boolean {
  if (error.code && DUPLICATE_EMAIL_AUTH_CODES.has(error.code)) {
    return true;
  }
  return /already registered|already exists/i.test(error.message ?? "");
}

function isUniqueViolation(error: { code?: string }): boolean {
  return error.code === POSTGRES_UNIQUE_VIOLATION;
}

function isNoRowsFound(error: { code?: string }): boolean {
  return error.code === POSTGREST_NO_ROWS;
}

function isInvalidInput(error: { code?: string }): boolean {
  return error.code === POSTGRES_INVALID_INPUT;
}

/**
 * Builds a partial update object containing only the fields present on
 * `input`, mapped to their `teachers` column names. Domain `instruments`
 * (a string array) is stored as comma-separated text, matching the
 * simplest column shape available (no separate instruments table).
 */
function buildUpdatePatch(input: UpdateTeacherInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) patch.name = input.name;
  if (input.bio !== undefined) patch.bio = input.bio;
  if (input.instruments !== undefined) patch.instruments = input.instruments.join(", ");
  if (input.education !== undefined) patch.education = input.education;
  if (input.credentials !== undefined) patch.credentials = input.credentials;
  if (input.location !== undefined) patch.location = input.location;
  if (input.onlineAvailability !== undefined) {
    patch.online_availability = input.onlineAvailability;
  }
  if (input.hourlyPrice !== undefined) patch.hourly_price = input.hourlyPrice;

  return patch;
}

function mapRow(row: TeacherRow): Teacher {
  return {
    id: row.id,
    name: row.name,
    hourlyPrice: row.hourly_price ?? null,
    bio: row.bio ?? null,
    instruments: parseInstruments(row.instruments),
    education: row.education ?? null,
    credentials: row.credentials ?? null,
    location: row.location ?? null,
    onlineAvailability: row.online_availability ?? null,
  };
}

function parseInstruments(value: string | null): string[] | null {
  if (!value) return null;
  const list = value
    .split(",")
    .map((instrument) => instrument.trim())
    .filter(Boolean);
  return list.length > 0 ? list : null;
}
