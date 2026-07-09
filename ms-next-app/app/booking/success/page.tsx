import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Payment received",
  description: "Your booking payment was received.",
};

export default function BookingSuccessPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="w-full max-w-md rounded-lg border border-black/[.08] bg-white p-8 text-center dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Payment received
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          We&apos;re finalizing your booking — you&apos;ll receive a
          confirmation once it&apos;s fully processed.
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          <Link
            href="/"
            className="text-sm text-zinc-600 underline dark:text-zinc-400"
          >
            Go to dashboard
          </Link>
        </p>
      </main>
    </div>
  );
}
