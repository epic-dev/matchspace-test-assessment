import type { Metadata } from "next";

import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Register as a teacher",
  description: "Create your public teacher profile.",
};

export default function RegisterPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="w-full max-w-md rounded-lg border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Register as a teacher
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Create an account to start receiving booking requests. You can add
          your bio, instruments, and availability afterwards.
        </p>
        <RegisterForm />
      </main>
    </div>
  );
}
