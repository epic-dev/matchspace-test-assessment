/**
 * Minimal logging seam so call sites depend on an interface, not
 * `console` directly. This implementation is a same-day placeholder —
 * swap it for a real structured logger (e.g. pino) before production;
 * nothing else in the codebase should need to change when that happens.
 */
export type Logger = {
  error(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
};

export const logger: Logger = {
  error(message, context) {
    console.error(message, context);
  },
  info(message, context) {
    console.info(message, context);
  },
};
