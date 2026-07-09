import { NextResponse } from "next/server";

import { loginSchema } from "@/lib/teachers/login-schema";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 400 },
    );
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Same generic message for wrong credentials and any other GoTrue
    // failure — avoids user enumeration and matches LoginForm's
    // single-message convention. Details still go to the server log.
    logger.error("POST /v1/login failed", { error });
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  return NextResponse.json(
    { user: { id: data.user.id, email: data.user.email } },
    { status: 200 },
  );
}
