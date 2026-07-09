import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DuplicateEmailError } from "@/lib/teachers/errors";
import { registerSchema } from "@/lib/teachers/register-schema";
import { SupabaseTeacherRepository } from "@/lib/teachers/teacher-supabase-repository";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const adminClient = createAdminClient();
  const repository = new SupabaseTeacherRepository(supabase, adminClient);

  try {
    const teacher = await repository.register(parsed.data);
    return NextResponse.json(teacher, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateEmailError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    // RepositoryError and any unexpected error both return the same
    // generic 500 (no internals leaked to the client) — but every case
    // is logged server-side with its cause so a real failure is
    // diagnosable instead of vanishing into a 500 with no trace.
    logger.error("POST /v1/register failed", { error });
    return NextResponse.json(
      { error: "Failed to register teacher" },
      { status: 500 },
    );
  }
}
