"use client";

import { useEffect } from "react";
import { useChatUi } from "@/components/chat/chat-ui-store";

/**
 * On the order confirmation page: opens the chat once per order, so the customer sees where the
 * payment details will arrive. Later visits to the same order leave it closed.
 */
export function OpenChatOnLoad({ orderId }: { orderId: string }) {
  const requestOpen = useChatUi((s) => s.requestOpen);
  useEffect(() => {
    const key = `bvsa-chat-opened-${orderId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // Private mode: open it anyway.
    }
    requestOpen();
  }, [orderId, requestOpen]);
  return null;
}
