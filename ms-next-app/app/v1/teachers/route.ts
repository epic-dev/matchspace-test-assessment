import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TeacherNotFoundError } from "@/lib/teachers/errors";
import { SupabaseTeacherRepository } from "@/lib/teachers/supabase-repository";
import { updateTeacherSchema } from "@/lib/teachers/update-schema";

export async function GET() {
  const supabase = await createClient();
  const repository = new SupabaseTeacherRepository(supabase);

  try {
    const teachers = await repository.list();
    return NextResponse.json(teachers, { status: 200 });
  } catch (error) {
    // RepositoryError and any unexpected error both return the same
    // generic 500 (no internals leaked to the client) — but every case
    // is logged server-side with its cause so a real failure is
    // diagnosable instead of vanishing into a 500 with no trace.
    logger.error("GET /v1/teachers failed", { error });
    return NextResponse.json({ error: "Failed to list teachers" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = updateTeacherSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const adminClient = createAdminClient();
  const repository = new SupabaseTeacherRepository(supabase, adminClient);

  try {
    const teacher = await repository.updateOwnProfile(user.id, parsed.data);
    return NextResponse.json(teacher, { status: 200 });
  } catch (error) {
    if (error instanceof TeacherNotFoundError) {
      // Shouldn't happen for an authenticated caller updating their own
      // row, but surfaced distinctly server-side rather than folded into
      // the generic 500 below.
      logger.error("PATCH /v1/teachers: authenticated user has no teacher row", {
        userId: user.id,
        error,
      });
      return NextResponse.json(
        { error: "Failed to update teacher profile" },
        { status: 500 },
      );
    }
    // RepositoryError and any unexpected error both return the same
    // generic 500 (no internals leaked to the client) — but every case
    // is logged server-side with its cause so a real failure is
    // diagnosable instead of vanishing into a 500 with no trace.
    logger.error("PATCH /v1/teachers failed", { error });
    return NextResponse.json(
      { error: "Failed to update teacher profile" },
      { status: 500 },
    );
  }
}
