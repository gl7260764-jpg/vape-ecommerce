"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react";
import { openMyAccount } from "@/app/actions/account";
import { useChatUi } from "@/components/chat/chat-ui-store";
import { cn } from "@/lib/utils";

/** Just an email: opens that account on this device, or makes it the first time. */
export function SignInForm() {
  const router = useRouter();
  const reloadStatus = useChatUi((s) => s.reloadStatus);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await openMyAccount({ email }).catch(() => ({ ok: false as const, error: "Something went wrong. Please try again in a moment." }));
          if (!result.ok) {
            setError(result.error);
            return;
          }
          reloadStatus();
          router.refresh();
        });
      }}
      className="mt-6 grid gap-3"
    >
      <label htmlFor="account-email" className="text-sm font-medium">
        Email
      </label>
      <input
        id="account-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setError(null);
        }}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "account-email-error" : undefined}
        className={cn(
          "h-12 w-full rounded-full border bg-background/40 px-5 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-ring/40",
          error ? "border-destructive" : "border-input"
        )}
      />
      {error && (
        <p id="account-email-error" role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
          <WarningCircleIcon className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Opening..." : "Continue"}
      </button>
      <p className="text-xs text-muted-foreground">Subscribed already? Use the same email.</p>
    </form>
  );
}
