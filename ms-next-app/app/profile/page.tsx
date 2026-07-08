import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = {
  title: "Complete your profile",
  description: "Add your bio, instruments, and availability.",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="w-full max-w-md rounded-lg border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        {user ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Complete your profile
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Tell students about your teaching — this is what they&apos;ll
              see on your public profile.
            </p>
            <ProfileForm />
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Please register first
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              You need a teacher account to complete a profile.
            </p>
            <Link
              href="/register"
              className="mt-6 inline-block rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Register as a teacher
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
