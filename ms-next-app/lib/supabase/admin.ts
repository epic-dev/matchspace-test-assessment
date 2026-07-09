import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getSupabaseSecretKey, getSupabaseUrl } from "./env";

/**
 * Service-role Supabase client for privileged, server-only operations
 * (e.g. `auth.admin.deleteUser`). Bypasses RLS — never expose to client
 * code and never use for regular request-scoped reads/writes, which must
 * go through the cookie-based client in `./server.ts` so RLS applies.
 */
export function createAdminClient() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseSecretKey = getSupabaseSecretKey();
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      "Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SECRET_KEY",
    );
  }
  return createSupabaseClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
