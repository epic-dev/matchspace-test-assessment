import type { Metadata } from "next";

import { AuthTabs } from "./AuthTabs";

export const metadata: Metadata = {
  title: "Sign up or log in",
  description: "Create your public teacher profile, or log in to manage it.",
};

export default function RegisterPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="w-full max-w-md rounded-lg border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Sign up or log in
        </h1>
        <AuthTabs />
      </main>
    </div>
  );
}
