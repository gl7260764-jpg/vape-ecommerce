"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowRightIcon, CheckIcon } from "@phosphor-icons/react";
import { subscribe, type SubscribeState } from "@/app/actions/newsletter";
import { useChatUi } from "@/components/chat/chat-ui-store";
import { markNewsletterSubscribed } from "@/components/newsletter/device-state";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HELP: Record<SubscribeState["status"], string> = {
  idle: "One email per drop. Unsubscribe anytime.",
  invalid: "Enter a valid email, like name@example.com.",
  failed: "We couldn't save that just now. Please try again.",
  done: "You're in. Watch your inbox for the next drop.",
};

export function NewsletterForm() {
  const [state, action, pending] = useActionState<SubscribeState, FormData>(subscribe, { status: "idle" });
  // Instant client-side check; the server action validates again before saving.
  const [localInvalid, setLocalInvalid] = useState(false);
  const status = localInvalid ? "invalid" : state.status;
  const done = status === "done";
  const isError = status === "invalid" || status === "failed";
  // Subscribed here: the pop-up never asks this device again, and the account it opened shows up.
  useEffect(() => {
    if (state.status !== "done") return;
    markNewsletterSubscribed();
    useChatUi.getState().reloadStatus(); // subscribing opened their account: show the message icon
  }, [state.status]);

  return (
    <form
      action={action}
      noValidate
      onSubmit={(e) => {
        const email = new FormData(e.currentTarget).get("email")?.toString().trim() ?? "";
        if (!EMAIL.test(email)) {
          e.preventDefault();
          setLocalInvalid(true);
        }
      }}
      className="w-full max-w-md"
    >
      <label htmlFor="newsletter-email" className="text-sm font-medium">
        Email address
      </label>
      <div className="mt-2 flex h-14 items-center rounded-full border border-input bg-background/40 pr-1.5 pl-5 transition-colors focus-within:border-primary">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={isError}
          aria-describedby="newsletter-help"
          disabled={done}
          onChange={() => localInvalid && setLocalInvalid(false)}
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={done || pending}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.97] disabled:opacity-90"
        >
          {done ? (
            <>
              <CheckIcon weight="bold" className="size-4" /> Subscribed
            </>
          ) : pending ? (
            "Saving..."
          ) : (
            <>
              Subscribe <ArrowRightIcon weight="bold" className="size-4" />
            </>
          )}
        </button>
      </div>
      <p
        id="newsletter-help"
        aria-live="polite"
        className={isError ? "mt-2 text-sm text-destructive" : "mt-2 text-sm text-muted-foreground"}
      >
        {HELP[status]}
      </p>
    </form>
  );
}
