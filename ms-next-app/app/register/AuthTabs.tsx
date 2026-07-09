"use client";

import { useState } from "react";

import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

type Tab = "signup" | "login";

const tabButtonBase = "px-3 py-2 text-sm font-medium transition-colors";
const tabButtonActive =
  "border-b-2 border-black text-black dark:border-zinc-50 dark:text-zinc-50";
const tabButtonInactive =
  "border-b-2 border-transparent text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50";

export function AuthTabs() {
  const [tab, setTab] = useState<Tab>("signup");

  return (
    <>
      <div
        role="tablist"
        aria-label="Sign up or log in"
        className="flex gap-2 border-b border-black/[.08] dark:border-white/[.145]"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "signup"}
          onClick={() => setTab("signup")}
          className={`${tabButtonBase} ${
            tab === "signup" ? tabButtonActive : tabButtonInactive
          }`}
        >
          Sign up
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "login"}
          onClick={() => setTab("login")}
          className={`${tabButtonBase} ${
            tab === "login" ? tabButtonActive : tabButtonInactive
          }`}
        >
          Log in
        </button>
      </div>

      {tab === "signup" ? (
        <>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Create an account to start receiving booking requests. You can add
            your bio, instruments, and availability afterwards.
          </p>
          <RegisterForm />
        </>
      ) : (
        <>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Log in to manage your teacher profile.
          </p>
          <LoginForm />
        </>
      )}
    </>
  );
}
