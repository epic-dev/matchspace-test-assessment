export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function getSupabasePublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

/**
 * Server-only secret key (never `NEXT_PUBLIC_`-prefixed) — grants admin
 * access via `auth.admin`. Only used for compensating actions, never for
 * regular request handling.
 */
export function getSupabaseSecretKey() {
  return process.env.SUPABASE_SECRET_KEY;
}
