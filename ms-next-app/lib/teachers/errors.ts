/** Thrown when registration is attempted with an email that's already in use. */
export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`An account with email ${email} already exists.`);
    this.name = "DuplicateEmailError";
  }
}

/**
 * Thrown when an update targets a teacher id with no matching row. Should
 * not happen for an authenticated caller updating their own row, but the
 * adapter guards against it rather than silently no-op'ing.
 */
export class TeacherNotFoundError extends Error {
  constructor(teacherId: string) {
    super(`No teacher found with id ${teacherId}.`);
    this.name = "TeacherNotFoundError";
  }
}

/** Thrown for any other repository failure (network, unexpected DB error, etc.). */
export class RepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RepositoryError";
  }
}
