function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabasePublishableKey(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

/**
 * Server-only secret key (never `NEXT_PUBLIC_`-prefixed) — grants admin
 * access via `auth.admin`. Only used for compensating actions, never for
 * regular request handling.
 */
export function getSupabaseSecretKey(): string {
  return requireEnv("SUPABASE_SECRET_KEY");
}
