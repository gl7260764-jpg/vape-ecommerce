"use client";

import type { ReactNode } from "react";
import { useChatUi } from "@/components/chat/chat-ui-store";

/** Opens the chat sheet from anywhere on the store (the navbar's message icon is the other way in). */
export function OpenChatButton({ className, children }: { className?: string; children: ReactNode }) {
  const setOpen = useChatUi((s) => s.setOpen);
  return (
    <button type="button" onClick={() => setOpen(true)} className={className}>
      {children}
    </button>
  );
}
