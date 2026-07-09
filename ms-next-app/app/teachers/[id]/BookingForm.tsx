"use client";

import { useId, useState, type FormEvent } from "react";

import { bookingSchema, type BookingRequest } from "@/lib/bookings/booking-schema";

type FieldErrors = Partial<Record<keyof BookingRequest, string[]>>;

type FormValues = {
  dateTime: string;
  hours: string;
  location: string;
  isOnline: boolean;
  studentName: string;
  studentEmail: string;
  message: string;
};

type BookingFormProps = {
  teacherId: string;
  /**
   * Seeds the isOnline toggle from the teacher's own `onlineAvailability`
   * (a real field on `Teacher`) — just a sensible default, not something the
   * student is locked into. The teacher has no `location` field to mirror,
   * so `location` always starts blank and is a plain student-filled input.
   */
  defaultIsOnline?: boolean;
};

function initialValues(defaultIsOnline: boolean): FormValues {
  return {
    dateTime: "",
    hours: "1",
    location: "",
    isOnline: defaultIsOnline,
    studentName: "",
    studentEmail: "",
    message: "",
  };
}

export function BookingForm({ teacherId, defaultIsOnline = false }: BookingFormProps) {
  const [values, setValues] = useState<FormValues>(() => initialValues(defaultIsOnline));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const dateTimeId = useId();
  const hoursId = useId();
  const locationId = useId();
  const isOnlineId = useId();
  const studentNameId = useId();
  const studentEmailId = useId();
  const messageId = useId();

  function updateTextField(field: "dateTime" | "hours" | "location" | "studentName" | "studentEmail" | "message") {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
    };
  }

  function updateIsOnline(event: React.ChangeEvent<HTMLInputElement>) {
    setValues((prev) => ({ ...prev, isOnline: event.target.checked }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccess(false);

    const payload: Record<string, unknown> = {
      teacherId,
      dateTime: values.dateTime,
      isOnline: values.isOnline,
      studentName: values.studentName,
      studentEmail: values.studentEmail,
    };
    if (values.hours.trim() !== "") {
      payload.hours = Number(values.hours);
    }
    if (values.location.trim() !== "") {
      payload.location = values.location;
    }
    if (values.message.trim() !== "") {
      payload.message = values.message;
    }

    const parsed = bookingSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    try {
      const response = await fetch("/v1/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (response.status === 201) {
        setSuccess(true);
        setValues(initialValues(defaultIsOnline));
        return;
      }

      const data = await response.json().catch(() => null);

      if (response.status === 409) {
        setFieldErrors({
          dateTime: [data?.error ?? "That time is no longer available"],
        });
        return;
      }

      if (response.status === 400) {
        setFieldErrors(data?.fieldErrors ?? {});
        setFormError(data?.error ?? "Please fix the errors below.");
        return;
      }

      if (response.status === 404) {
        setFormError("This teacher is no longer available for booking.");
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
    <form className="mt-6 flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1">
        <label
          htmlFor={dateTimeId}
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          Date &amp; time
        </label>
        <input
          id={dateTimeId}
          name="dateTime"
          type="datetime-local"
          value={values.dateTime}
          onChange={updateTextField("dateTime")}
          aria-invalid={fieldErrors.dateTime ? true : undefined}
          aria-describedby={fieldErrors.dateTime ? `${dateTimeId}-error` : undefined}
          className="rounded-md border border-black/[.15] bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-black/40 dark:border-white/[.2] dark:text-zinc-50 dark:focus:border-white/40"
        />
        {fieldErrors.dateTime?.map((message) => (
          <p
            key={message}
            id={`${dateTimeId}-error`}
            className="text-sm text-red-600 dark:text-red-400"
          >
            {message}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={hoursId}
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          Hours
        </label>
        <input
          id={hoursId}
          name="hours"
          type="number"
          min="0.5"
          step="0.5"
          inputMode="decimal"
          value={values.hours}
          onChange={updateTextField("hours")}
          aria-invalid={fieldErrors.hours ? true : undefined}
          aria-describedby={fieldErrors.hours ? `${hoursId}-error` : undefined}
          className="rounded-md border border-black/[.15] bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-black/40 dark:border-white/[.2] dark:text-zinc-50 dark:focus:border-white/40"
        />
        {fieldErrors.hours?.map((message) => (
          <p
            key={message}
            id={`${hoursId}-error`}
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
          placeholder="e.g. your address, or leave blank if online"
          value={values.location}
          onChange={updateTextField("location")}
          aria-invalid={fieldErrors.location ? true : undefined}
          aria-describedby={fieldErrors.location ? `${locationId}-error` : undefined}
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
          id={isOnlineId}
          name="isOnline"
          type="checkbox"
          checked={values.isOnline}
          onChange={updateIsOnline}
          aria-invalid={fieldErrors.isOnline ? true : undefined}
          aria-describedby={fieldErrors.isOnline ? `${isOnlineId}-error` : undefined}
          className="h-4 w-4 rounded border-black/[.15] dark:border-white/[.2]"
        />
        <label
          htmlFor={isOnlineId}
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          This lesson is online
        </label>
      </div>
      {fieldErrors.isOnline?.map((message) => (
        <p
          key={message}
          id={`${isOnlineId}-error`}
          className="text-sm text-red-600 dark:text-red-400"
        >
          {message}
        </p>
      ))}

      <div className="flex flex-col gap-1">
        <label
          htmlFor={studentNameId}
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          Your name
        </label>
        <input
          id={studentNameId}
          name="studentName"
          type="text"
          autoComplete="name"
          value={values.studentName}
          onChange={updateTextField("studentName")}
          aria-invalid={fieldErrors.studentName ? true : undefined}
          aria-describedby={
            fieldErrors.studentName ? `${studentNameId}-error` : undefined
          }
          className="rounded-md border border-black/[.15] bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-black/40 dark:border-white/[.2] dark:text-zinc-50 dark:focus:border-white/40"
        />
        {fieldErrors.studentName?.map((message) => (
          <p
            key={message}
            id={`${studentNameId}-error`}
            className="text-sm text-red-600 dark:text-red-400"
          >
            {message}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={studentEmailId}
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          Your email
        </label>
        <input
          id={studentEmailId}
          name="studentEmail"
          type="email"
          autoComplete="email"
          value={values.studentEmail}
          onChange={updateTextField("studentEmail")}
          aria-invalid={fieldErrors.studentEmail ? true : undefined}
          aria-describedby={
            fieldErrors.studentEmail ? `${studentEmailId}-error` : undefined
          }
          className="rounded-md border border-black/[.15] bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-black/40 dark:border-white/[.2] dark:text-zinc-50 dark:focus:border-white/40"
        />
        {fieldErrors.studentEmail?.map((message) => (
          <p
            key={message}
            id={`${studentEmailId}-error`}
            className="text-sm text-red-600 dark:text-red-400"
          >
            {message}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={messageId}
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          Message (optional)
        </label>
        <textarea
          id={messageId}
          name="message"
          rows={3}
          value={values.message}
          onChange={updateTextField("message")}
          aria-invalid={fieldErrors.message ? true : undefined}
          aria-describedby={fieldErrors.message ? `${messageId}-error` : undefined}
          className="rounded-md border border-black/[.15] bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-black/40 dark:border-white/[.2] dark:text-zinc-50 dark:focus:border-white/40"
        />
        {fieldErrors.message?.map((message) => (
          <p
            key={message}
            id={`${messageId}-error`}
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
          Booking request sent — pending confirmation.
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {submitting ? "Sending…" : "Request booking"}
      </button>
    </form>
  );
}
