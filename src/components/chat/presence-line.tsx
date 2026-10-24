"use client";

import { lastSeenText, useNow } from "@/components/chat/format";
import { cn } from "@/lib/utils";

/** "typing…", "Online", "Last seen today at 3:41 pm", or the fallback when they've never been seen. */
export function PresenceLine({
  online,
  lastSeenAt,
  typing,
  fallback,
  className,
}: {
  online: boolean;
  lastSeenAt: string | null;
  typing: boolean;
  fallback: string;
  className?: string;
}) {
  const now = useNow();
  const text = typing ? "typing…" : online ? "Online" : lastSeenAt && now ? lastSeenText(lastSeenAt, now) : fallback;
  return (
    <p aria-live="polite" className={cn("flex items-center gap-1.5 truncate text-xs", typing || online ? "text-primary-ink" : "text-muted-foreground", className)}>
      {online && !typing && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary-ink" />}
      {text}
    </p>
  );
}
