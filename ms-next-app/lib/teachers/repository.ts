/** Public teacher profile, as returned to callers (never includes credentials). */
export type Teacher = {
  id: string;
  name: string;
  bio: string | null;
  instruments: string[] | null;
  education: string | null;
  credentials: string | null;
  onlineAvailability: boolean | null;
  hourlyPrice: number | null;
};

export type RegisterTeacherInput = {
  name: string;
  email: string;
  password: string;
  hourlyPrice?: number;
};

/**
 * Partial update to a teacher's own profile (spec's `PATCH /v1/teachers`
 * body). Every field is optional — an omitted field is left untouched by
 * the adapter, not reset to null.
 */
export type UpdateTeacherInput = {
  name?: string;
  bio?: string;
  instruments?: string[];
  education?: string;
  credentials?: string;
  location?: string;
  onlineAvailability?: boolean;
  hourlyPrice?: number;
};

/**
 * Port for teacher persistence. Implementations own both the auth-account
 * creation and the profile row — callers shouldn't need to know it's two
 * operations under the hood.
 */
export interface TeacherRepository {
  register(input: RegisterTeacherInput): Promise<Teacher>;
  /**
   * Updates the profile row belonging to `userId` (the currently
   * authenticated teacher — never taken from the request body). Only the
   * fields present on `input` are changed.
   */
  updateOwnProfile(userId: string, input: UpdateTeacherInput): Promise<Teacher>;
  /** Returns every registered teacher, ordered alphabetically by name. */
  list(): Promise<Teacher[]>;
  /** Returns a single teacher by id, or `null` if none exists (including a malformed id). */
  getById(id: string): Promise<Teacher | null>;
}
