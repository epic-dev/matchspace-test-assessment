import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";

import { DuplicateEmailError, RepositoryError } from "./errors";
import type { RegisterTeacherInput, Teacher, TeacherRepository } from "./repository";

/** Postgres unique_violation error code. */
const POSTGRES_UNIQUE_VIOLATION = "23505";

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
};

export class SupabaseTeacherRepository implements TeacherRepository {
  /**
   * @param supabase Cookie-based, session-scoped client — used for the
   *   actual signUp + insert so RLS applies as the registering user.
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

function mapRow(row: TeacherRow): Teacher {
  return {
    id: row.id,
    name: row.name,
    hourlyPrice: row.hourly_price ?? null,
  };
}
