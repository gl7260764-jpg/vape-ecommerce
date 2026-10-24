import { CheckIcon, ChecksIcon, ClockIcon } from "@phosphor-icons/react";
import type { ChatMessage } from "@/components/chat/use-chat";
import { cn } from "@/lib/utils";

/** One tick: saved. Two grey: on their screen. Two in the accent: read. A clock while sending. */
export function Ticks({ message, className }: { message: ChatMessage; className?: string }) {
  if (message.status === "failed") return null;
  const [label, Icon, tone] =
    message.status === "sending"
      ? (["Sending", ClockIcon, "text-muted-foreground"] as const)
      : message.readAt
        ? (["Read", ChecksIcon, "text-primary-ink"] as const)
        : message.deliveredAt
          ? (["Delivered", ChecksIcon, "text-muted-foreground"] as const)
          : (["Sent", CheckIcon, "text-muted-foreground"] as const);
  return (
    <span role="img" aria-label={label} title={label} className={cn("inline-flex", tone, className)}>
      <Icon weight="bold" className="size-3.5" aria-hidden />
    </span>
  );
}
