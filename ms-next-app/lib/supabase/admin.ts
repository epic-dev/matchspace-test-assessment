import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getSupabaseSecretKey, getSupabaseUrl } from "./env";

/**
 * Service-role Supabase client for privileged, server-only operations
 * (e.g. `auth.admin.deleteUser`). Bypasses RLS — never expose to client
 * code and never use for regular request-scoped reads/writes, which must
 * go through the cookie-based client in `./server.ts` so RLS applies.
 */
export function createAdminClient() {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
