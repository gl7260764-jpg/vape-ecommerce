"use client";

import { useState, useTransition } from "react";
import { ArrowRightIcon, ChatCircleDotsIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { startChatAction } from "@/app/actions/chat";
import { cn } from "@/lib/utils";

const INPUT = "h-11 w-full min-w-0 rounded-full border border-input bg-surface px-4 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-ring/40";

/** The live chat before this device has an account: an email and a first message start it. */
export function StartChat({ onStarted }: { onStarted: () => void }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // a trap for bots: people never see it
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await startChatAction({ email, message, website }).catch(() => ({ ok: false as const, error: "Something went wrong. Please try again in a moment." }));
      if (!result.ok) return setError(result.error);
      onStarted();
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-surface py-3 pr-14 pl-4">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-black text-primary-foreground">
          B
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">Best Vape Shop</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-primary-ink" />
            We usually reply in a few minutes
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <span aria-hidden className="grid size-14 place-items-center rounded-2xl bg-primary/12 text-primary-ink">
          <ChatCircleDotsIcon className="size-7" />
        </span>
        <h2 className="mt-4 font-display text-xl font-semibold">Start the conversation</h2>
        <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
          Hi! Questions about a flavour, an order or delivery? Send us a message and a real person will reply.
        </p>
      </div>

      <form onSubmit={send} noValidate className="grid gap-2 border-t border-border bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <label htmlFor="start-chat-email" className="sr-only">
          Your email
        </label>
        <input
          id="start-chat-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Your email, so we can reply"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          aria-invalid={Boolean(error)}
          className={INPUT}
        />
        <div className="flex gap-2">
          <label htmlFor="start-chat-message" className="sr-only">
            Message
          </label>
          <input
            id="start-chat-message"
            placeholder="Type a message…"
            maxLength={4000}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setError(null);
            }}
            className={INPUT}
          />
          <button
            type="submit"
            disabled={pending}
            aria-label="Send"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-60"
          >
            <ArrowRightIcon weight="bold" className="size-5" aria-hidden />
          </button>
        </div>
        <input
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="pointer-events-none absolute -left-[9999px] size-px opacity-0"
        />
        {error && (
          <p role="alert" className="flex items-center gap-1.5 px-1 text-sm text-destructive">
            <WarningCircleIcon className="size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
        <p className={cn("px-1 text-center text-[11px] text-muted-foreground/80")}>Sending opens your account with this email. Adults 18+ only.</p>
      </form>
    </div>
  );
}
