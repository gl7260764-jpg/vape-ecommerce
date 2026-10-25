"use client";

import { ChatsCircleIcon } from "@phosphor-icons/react";
import { useChatUi } from "@/components/chat/chat-ui-store";

/** Opens the live chat window, like the floating chat button: a new visitor gets the start-a-chat form. */
export function ContactChatButton({ className }: { className?: string }) {
  const setOpen = useChatUi((s) => s.setOpen);
  return (
    <button type="button" onClick={() => setOpen(true)} className={className}>
      <ChatsCircleIcon className="size-4" aria-hidden />
      Chat with us
    </button>
  );
}
