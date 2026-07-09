import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payment cancelled",
  description: "Your booking payment was cancelled.",
};

export default function BookingCancelPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="w-full max-w-md rounded-lg border border-black/[.08] bg-white p-8 text-center dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Payment cancelled
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Your payment was cancelled and your booking has not been confirmed.
          You can try again whenever you&apos;re ready.
        </p>
      </main>
    </div>
  );
}
