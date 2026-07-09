import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";

import { createClient } from "@/lib/supabase/server";

import { SupabaseTeacherRepository } from "@/lib/teachers/teacher-supabase-repository";


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
