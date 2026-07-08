/** Thrown when registration is attempted with an email that's already in use. */
export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`An account with email ${email} already exists.`);
    this.name = "DuplicateEmailError";
  }
}

/** Thrown for any other repository failure (network, unexpected DB error, etc.). */
export class RepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RepositoryError";
  }
}
