import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

/**
 * Browser-side Supabase client. Safe to call from client components —
 * persists the session in cookies via `@supabase/ssr`.
 */
export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey());
}
