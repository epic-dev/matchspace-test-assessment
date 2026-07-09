"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { logger } from "@/lib/logger";

export function SignOutButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleSignOut() {
    setSubmitting(true);
    try {
      const response = await fetch("/v1/logout", { method: "POST" });
      if (!response.ok) {
        logger.error("Sign out failed", { status: response.status });
      }
      router.push("/");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={submitting}
      className="mt-6 rounded-full border border-black/[.15] px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-black/[.05] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
    >
      {submitting ? "Signing out…" : "Sign out"}
    </button>
  );
}
