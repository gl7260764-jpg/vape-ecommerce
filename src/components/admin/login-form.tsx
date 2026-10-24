"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { WarningCircleIcon } from "@phosphor-icons/react";
import { signIn } from "@/app/actions/admin/auth";
import { CONTROL, Field } from "@/components/admin/ui/form";
import { cn } from "@/lib/utils";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await signIn({ email: String(data.get("email") ?? ""), password: String(data.get("password") ?? ""), next });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Signed in");
      router.replace(result.data.redirectTo);
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field id="email" label="Email">
        <input id="email" name="email" type="email" autoComplete="username" inputMode="email" required autoFocus className={cn(CONTROL, "h-11")} />
      </Field>
      <Field id="password" label="Password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={cn(CONTROL, "h-11")} />
      </Field>
      {error && (
        <p role="alert" className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
