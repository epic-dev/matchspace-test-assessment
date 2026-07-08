"use client";

import { useId, useState, type FormEvent } from "react";

import { registerSchema, type RegisterInput } from "@/lib/teachers/register-schema";

type FieldErrors = Partial<Record<keyof RegisterInput, string[]>>;

type FormValues = {
  name: string;
  email: string;
  password: string;
  hourlyPrice: string;
};

const initialValues: FormValues = {
  name: "",
  email: "",
  password: "",
  hourlyPrice: "",
};

export function RegisterForm() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const hourlyPriceId = useId();

  if (success) {
    return (
      <p
        role="status"
        className="mt-6 rounded-md border border-green-600/20 bg-green-50 p-4 text-sm text-green-800 dark:border-green-500/30 dark:bg-green-950 dark:text-green-300"
      >
        You&apos;re registered. You can now sign in and finish setting up your
        profile (bio, instruments, availability).
      </p>
    );
  }

  function updateField(field: keyof FormValues) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const payload: Record<string, unknown> = {
      name: values.name,
      email: values.email,
      password: values.password,
    };
    if (values.hourlyPrice.trim() !== "") {
      payload.hourlyPrice = Number(values.hourlyPrice);
    }

    const parsed = registerSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    try {
      const response = await fetch("/v1/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (response.status === 201) {
        setSuccess(true);
        return;
      }

      const data = await response.json().catch(() => null);

      if (response.status === 400) {
        setFieldErrors(data?.fieldErrors ?? {});
        setFormError(data?.error ?? "Please fix the errors below.");
        return;
      }

      if (response.status === 409) {
        setFormError(
          data?.error ?? "An account with this email already exists.",
        );
        return;
      }

      setFormError("Something went wrong. Please try again.");
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="mt-6 flex flex-col gap-4"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor={nameId}
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          Full name
        </label>
        <input
          id={nameId}
          name="name"
          type="text"
          autoComplete="name"
          value={values.name}
          onChange={updateField("name")}
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={fieldErrors.name ? `${nameId}-error` : undefined}
          className="rounded-md border border-black/[.15] bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-black/40 dark:border-white/[.2] dark:text-zinc-50 dark:focus:border-white/40"
        />
        {fieldErrors.name?.map((message) => (
          <p
            key={message}
            id={`${nameId}-error`}
            className="text-sm text-red-600 dark:text-red-400"
          >
            {message}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={emailId}
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          Email
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={updateField("email")}
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? `${emailId}-error` : undefined}
          className="rounded-md border border-black/[.15] bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-black/40 dark:border-white/[.2] dark:text-zinc-50 dark:focus:border-white/40"
        />
        {fieldErrors.email?.map((message) => (
          <p
            key={message}
            id={`${emailId}-error`}
            className="text-sm text-red-600 dark:text-red-400"
          >
            {message}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={passwordId}
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          Password
        </label>
        <input
          id={passwordId}
          name="password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={updateField("password")}
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={
            fieldErrors.password ? `${passwordId}-error` : undefined
          }
          className="rounded-md border border-black/[.15] bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-black/40 dark:border-white/[.2] dark:text-zinc-50 dark:focus:border-white/40"
        />
        {fieldErrors.password?.map((message) => (
          <p
            key={message}
            id={`${passwordId}-error`}
            className="text-sm text-red-600 dark:text-red-400"
          >
            {message}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={hourlyPriceId}
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          Hourly price (optional)
        </label>
        <input
          id={hourlyPriceId}
          name="hourlyPrice"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={values.hourlyPrice}
          onChange={updateField("hourlyPrice")}
          aria-invalid={fieldErrors.hourlyPrice ? true : undefined}
          aria-describedby={
            fieldErrors.hourlyPrice ? `${hourlyPriceId}-error` : undefined
          }
          className="rounded-md border border-black/[.15] bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-black/40 dark:border-white/[.2] dark:text-zinc-50 dark:focus:border-white/40"
        />
        {fieldErrors.hourlyPrice?.map((message) => (
          <p
            key={message}
            id={`${hourlyPriceId}-error`}
            className="text-sm text-red-600 dark:text-red-400"
          >
            {message}
          </p>
        ))}
      </div>

      {formError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {submitting ? "Registering…" : "Register"}
      </button>
    </form>
  );
}
