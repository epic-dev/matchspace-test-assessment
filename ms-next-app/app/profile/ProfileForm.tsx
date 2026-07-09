"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useId, useState } from "react";

import {
  updateTeacherSchema,
  type UpdateTeacherRequest,
} from "@/lib/teachers/update-schema";
import { convertPriceToCents } from "@/utils/priceConverter";

type FieldErrors = Partial<Record<keyof UpdateTeacherRequest, string[]>>;

type FormValues = {
  bio: string;
  instruments: string;
  education: string;
  credentials: string;
  location: string;
  onlineAvailability: boolean;
  hourlyPrice: string;
};

const initialValues: FormValues = {
  bio: "",
  instruments: "",
  education: "",
  credentials: "",
  location: "",
  onlineAvailability: false,
  hourlyPrice: "",
};

export function ProfileForm() {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const bioId = useId();
  const instrumentsId = useId();
  const educationId = useId();
  const credentialsId = useId();
  const locationId = useId();
  const onlineAvailabilityId = useId();
  const hourlyPriceId = useId();
 
  function updateTextField(field: "bio" | "education" | "credentials" | "location") {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
    };
  }

  function updateInstruments(event: React.ChangeEvent<HTMLInputElement>) {
    setValues((prev) => ({ ...prev, instruments: event.target.value }));
  }

  function updateOnlineAvailability(event: React.ChangeEvent<HTMLInputElement>) {
    setValues((prev) => ({
      ...prev,
      onlineAvailability: event.target.checked,
    }));
  }

  async function handleSubmit(event: ChangeEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccess(false);

    const payload: Record<string, unknown> = {
      bio: values.bio,
      instruments: values.instruments
        .split(",")
        .map((instrument) => instrument.trim())
        .filter((instrument) => instrument.length > 0),
      education: values.education,
      credentials: values.credentials,
      location: values.location,
      onlineAvailability: values.onlineAvailability,
      hourlyPrice: convertPriceToCents(parseFloat(values.hourlyPrice) || 0),
    };

    const parsed = updateTeacherSchema.safeParse(payload);
    console.log("Parsed data:", parsed);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    try {
      const response = await fetch("/v1/teachers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (response.status === 200) {
        setSuccess(true);
        return;
      }

      if (response.status === 401) {
        router.push("/register");
        return;
      }

      const data = await response.json().catch(() => null);

      if (response.status === 400) {
        setFieldErrors(data?.fieldErrors ?? {});
        setFormError(data?.error ?? "Please fix the errors below.");
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
          htmlFor={bioId}
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          Short bio
        </label>
        <textarea
          id={bioId}
          name="bio"
          rows={3}
          value={values.bio}
          onChange={updateTextField("bio")}
          aria-invalid={fieldErrors.bio ? true : undefined}
          aria-describedby={fieldErrors.bio ? `${bioId}-error` : undefined}
          className="rounded-md border border-black/[.15] bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-black/40 dark:border-white/[.2] dark:text-zinc-50 dark:focus:border-white/40"
        />
        {fieldErrors.bio?.map((message) => (
          <p
            key={message}
            id={`${bioId}-error`}
            className="text-sm text-red-600 dark:text-red-400"
          >
            {message}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={instrumentsId}
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          Instruments (comma-separated)
        </label>
        <input
          id={instrumentsId}
          name="instruments"
          type="text"
          placeholder="piano, guitar"
          value={values.instruments}
          onChange={updateInstruments}
          aria-invalid={fieldErrors.instruments ? true : undefined}
          aria-describedby={
            fieldErrors.instruments ? `${instrumentsId}-error` : undefined
          }
          className="rounded-md border border-black/[.15] bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-black/40 dark:border-white/[.2] dark:text-zinc-50 dark:focus:border-white/40"
        />
        {fieldErrors.instruments?.map((message) => (
          <p
            key={message}
            id={`${instrumentsId}-error`}
            className="text-sm text-red-600 dark:text-red-400"
          >
            {message}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={educationId}
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          Education
        </label>
        <input
          id={educationId}
          name="education"
          type="text"
          value={values.education}
          onChange={updateTextField("education")}
          aria-invalid={fieldErrors.education ? true : undefined}
          aria-describedby={
            fieldErrors.education ? `${educationId}-error` : undefined
          }
          className="rounded-md border border-black/[.15] bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-black/40 dark:border-white/[.2] dark:text-zinc-50 dark:focus:border-white/40"
        />
        {fieldErrors.education?.map((message) => (
          <p
            key={message}
            id={`${educationId}-error`}
            className="text-sm text-red-600 dark:text-red-400"
          >
            {message}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={credentialsId}
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          Credentials
        </label>
        <input
          id={credentialsId}
          name="credentials"
          type="text"
          value={values.credentials}
          onChange={updateTextField("credentials")}
          aria-invalid={fieldErrors.credentials ? true : undefined}
          aria-describedby={
            fieldErrors.credentials ? `${credentialsId}-error` : undefined
          }
          className="rounded-md border border-black/[.15] bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-black/40 dark:border-white/[.2] dark:text-zinc-50 dark:focus:border-white/40"
        />
        {fieldErrors.credentials?.map((message) => (
          <p
            key={message}
            id={`${credentialsId}-error`}
            className="text-sm text-red-600 dark:text-red-400"
          >
            {message}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={locationId}
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          Lesson location
        </label>
        <input
          id={locationId}
          name="location"
          type="text"
          placeholder="e.g. Downtown studio, or leave blank if online-only"
          value={values.location}
          onChange={updateTextField("location")}
          aria-invalid={fieldErrors.location ? true : undefined}
          aria-describedby={
            fieldErrors.location ? `${locationId}-error` : undefined
          }
          className="rounded-md border border-black/[.15] bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-black/40 dark:border-white/[.2] dark:text-zinc-50 dark:focus:border-white/40"
        />
        {fieldErrors.location?.map((message) => (
          <p
            key={message}
            id={`${locationId}-error`}
            className="text-sm text-red-600 dark:text-red-400"
          >
            {message}
          </p>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          id={onlineAvailabilityId}
          name="onlineAvailability"
          type="checkbox"
          checked={values.onlineAvailability}
          onChange={updateOnlineAvailability}
          aria-invalid={fieldErrors.onlineAvailability ? true : undefined}
          aria-describedby={
            fieldErrors.onlineAvailability
              ? `${onlineAvailabilityId}-error`
              : undefined
          }
          className="h-4 w-4 rounded border-black/[.15] dark:border-white/[.2]"
        />
        <label
          htmlFor={onlineAvailabilityId}
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          I offer online lessons
        </label>
      </div>
      {fieldErrors.onlineAvailability?.map((message) => (
        <p
          key={message}
          id={`${onlineAvailabilityId}-error`}
          className="text-sm text-red-600 dark:text-red-400"
        >
          {message}
        </p>
      ))}

      <div className="flex flex-col gap-1">
        <label
          htmlFor={hourlyPriceId}
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          Hourly price (EUR)
        </label>
        <input
          id={hourlyPriceId}
          name="hourlyPrice"
          type="text"
          value={values.hourlyPrice}
          placeholder="50.0"
          onChange={(event) =>
            setValues((prev) => ({ ...prev, hourlyPrice: event.target.value || "" }))
          }
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

      {success && (
        <p role="status" className="text-sm text-green-600 dark:text-green-400">
          Profile updated successfully.
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {submitting ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
