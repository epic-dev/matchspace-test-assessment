import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SupabaseTeacherRepository } from "@/lib/teachers/supabase-repository";

/** Shown in place of a field that hasn't been filled in yet. */
const NOT_PROVIDED = "Not provided yet";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TeacherDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const repository = new SupabaseTeacherRepository(supabase);

  const teacher = await repository.getById(id);

  if (!teacher) {
    notFound();
  }

  const instrumentsText =
    teacher.instruments && teacher.instruments.length > 0
      ? teacher.instruments.join(", ")
      : NOT_PROVIDED;

  const hourlyPriceText =
    teacher.hourlyPrice !== null ? `$${teacher.hourlyPrice}/hour` : NOT_PROVIDED;

  const onlineAvailabilityText =
    teacher.onlineAvailability === null
      ? NOT_PROVIDED
      : teacher.onlineAvailability
        ? "Offers online lessons"
        : "In-person lessons only";

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="w-full max-w-2xl rounded-lg border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        <Link
          href="/"
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          &larr; Back to all teachers
        </Link>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          {teacher.name}
        </h1>

        <dl className="mt-6 flex flex-col gap-6">
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Instruments
            </dt>
            <dd className="mt-1 text-black dark:text-zinc-50">{instrumentsText}</dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Bio
            </dt>
            <dd className="mt-1 whitespace-pre-line text-black dark:text-zinc-50">
              {teacher.bio || NOT_PROVIDED}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Education
            </dt>
            <dd className="mt-1 text-black dark:text-zinc-50">
              {teacher.education || NOT_PROVIDED}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Credentials
            </dt>
            <dd className="mt-1 text-black dark:text-zinc-50">
              {teacher.credentials || NOT_PROVIDED}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Online availability
            </dt>
            <dd className="mt-1 text-black dark:text-zinc-50">
              {onlineAvailabilityText}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Hourly price
            </dt>
            <dd className="mt-1 text-black dark:text-zinc-50">{hourlyPriceText}</dd>
          </div>
        </dl>
      </main>
    </div>
  );
}
