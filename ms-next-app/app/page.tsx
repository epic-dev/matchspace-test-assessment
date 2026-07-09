import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { SupabaseTeacherRepository } from "@/lib/teachers/teacher-supabase-repository";
import { convertCentsToPrice } from "@/utils/priceConverter";

export default async function Home() {
  const supabase = await createClient();
  const repository = new SupabaseTeacherRepository(supabase);

  const [
    {
      data: { user },
    },
    teachers,
  ] = await Promise.all([supabase.auth.getUser(), repository.list()]);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Find a music teacher
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Browse teachers and book a lesson.
            </p>
          </div>
          <Link
            href={user ? "/profile" : "/register"}
            className="mt-1 inline-block shrink-0 rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            {user ? "My profile" : "Sign in / Sign up"}
          </Link>
        </div>

        {teachers.length === 0 ? (
          <p className="mt-10 text-zinc-600 dark:text-zinc-400">
            No teachers yet. Check back soon.
          </p>
        ) : (
          <ul className="mt-10 flex flex-col gap-4">
            {teachers.map((teacher) => (
              <li
                key={teacher.id}
                className="rounded-lg border border-black/[.08] bg-white p-5 dark:border-white/[.145] dark:bg-zinc-950"
              >
                <Link
                  href={`/teachers/${teacher.id}`}
                  className="text-lg font-medium text-black hover:underline dark:text-zinc-50"
                >
                  {teacher.name}
                </Link>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {teacher.instruments && teacher.instruments.length > 0
                    ? teacher.instruments.join(", ")
                    : "Instruments not specified"}
                </p>
                {teacher.hourlyPrice !== null && (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    ${convertCentsToPrice(teacher.hourlyPrice)}/hr
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
