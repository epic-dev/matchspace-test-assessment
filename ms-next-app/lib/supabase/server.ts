import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

/**
 * Server-side Supabase client for use inside route handlers / server
 * components. Reads and writes the auth session via Next.js's cookie store
 * so RLS policies see the calling user's session.
 *
 * Must be created fresh per request — never shared/cached across requests.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // `setAll` is called from a Server Component during rendering,
          // where cookie writes aren't allowed. Safe to ignore as long as
          // middleware (if added later) refreshes the session.
        }
      },
    },
  });
}
