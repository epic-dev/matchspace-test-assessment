import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { SupabaseTeacherRepository } from "@/lib/teachers/teacher-supabase-repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const repository = new SupabaseTeacherRepository(supabase);

  try {
    const teacher = await repository.getById(id);

    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    return NextResponse.json(teacher, { status: 200 });
  } catch (error) {
    // RepositoryError and any unexpected error both return the same
    // generic 500 (no internals leaked to the client) — but every case
    // is logged server-side with its cause so a real failure is
    // diagnosable instead of vanishing into a 500 with no trace.
    logger.error("GET /v1/teachers/[id] failed", { error, id });
    return NextResponse.json({ error: "Failed to fetch teacher" }, { status: 500 });
  }
}
