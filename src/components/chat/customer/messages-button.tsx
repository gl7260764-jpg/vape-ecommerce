"use client";

import { ChatCircleDotsIcon } from "@phosphor-icons/react";
import { useChatUi } from "@/components/chat/chat-ui-store";

/** The navbar's message icon: only on a device signed into an account, with the team's unread messages. */
export function MessagesButton() {
  const { signedIn, unread, setOpen } = useChatUi();
  if (!signedIn) return null;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={unread ? `Messages, ${unread} unread` : "Messages"}
      title="Messages"
      className="relative grid size-9 place-items-center rounded-full hover:bg-surface-2 sm:size-10"
    >
      <ChatCircleDotsIcon className="size-[22px]" aria-hidden />
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute top-0 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 font-mono text-[11px] leading-none font-semibold text-primary-foreground ring-2 ring-background"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}
