"use client";

import { useState, useTransition } from "react";
import { CheckCircleIcon, PaperPlaneTiltIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { sendEnquiry } from "@/app/actions/contact";
import { cn } from "@/lib/utils";

const INPUT =
  "w-full rounded-xl border bg-background/40 px-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-ring/40";
const EMPTY = { name: "", email: "", phone: "", message: "", website: "" };

function Field({ id, label, optional, error, children }: { id: string; label: string; optional?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-sm text-destructive">
          <WarningCircleIcon className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

/** The contact page's message box: name, email, phone and message, sent to the team. */
export function EnquiryForm() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof EMPTY, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };
  const field = (key: keyof typeof EMPTY) => ({
    id: `enquiry-${key}`,
    value: values[key],
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? `enquiry-${key}-error` : undefined,
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(undefined);
    startTransition(async () => {
      const result = await sendEnquiry(values);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.error);
        return;
      }
      setSentTo(result.firstName);
    });
  };

  if (sentTo !== null)
    return (
      <div role="status" className="flex flex-col items-start gap-3 rounded-[var(--radius-tile)] border border-border bg-surface p-6 sm:p-8">
        <CheckCircleIcon weight="fill" className="size-9 text-primary-ink" aria-hidden />
        <p className="text-lg font-semibold">Thanks, {sentTo}. We&apos;ve got your message.</p>
        <p className="text-sm text-muted-foreground">We&apos;ll reply to {values.email.trim().toLowerCase()} soon.</p>
      </div>
    );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 rounded-[var(--radius-tile)] border border-border bg-surface p-6 sm:grid-cols-2 sm:p-8">
      <Field id="enquiry-name" label="Name" error={errors.name}>
        <input {...field("name")} autoComplete="name" onChange={(e) => set("name", e.target.value)} className={cn(INPUT, "h-12")} />
      </Field>
      <Field id="enquiry-email" label="Email" error={errors.email}>
        <input {...field("email")} type="email" autoComplete="email" onChange={(e) => set("email", e.target.value)} className={cn(INPUT, "h-12")} />
      </Field>
      <Field id="enquiry-phone" label="Phone" optional error={errors.phone}>
        <input {...field("phone")} type="tel" autoComplete="tel" onChange={(e) => set("phone", e.target.value)} className={cn(INPUT, "h-12")} />
      </Field>
      <div className="hidden sm:block" />
      <div className="sm:col-span-2">
        <Field id="enquiry-message" label="Message" error={errors.message}>
          <textarea {...field("message")} rows={5} maxLength={2000} onChange={(e) => set("message", e.target.value)} className={cn(INPUT, "py-3")} />
        </Field>
      </div>
      {/* A field people never see: bots fill it in. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={values.website} onChange={(e) => set("website", e.target.value)} />
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          <PaperPlaneTiltIcon className="size-4" aria-hidden />
          {pending ? "Sending..." : "Send message"}
        </button>
        {formError && <p className="text-sm text-destructive">{formError}</p>}
      </div>
    </form>
  );
}
