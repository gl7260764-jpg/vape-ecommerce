"use client";

import { useEffect } from "react";
import { useChatUi } from "@/components/chat/chat-ui-store";

/** Opens the chat as soon as it's ready: a notification about a reply lands on /account?chat=1. */
export function OpenChatNow() {
  const requestOpen = useChatUi((s) => s.requestOpen);
  useEffect(() => requestOpen(), [requestOpen]);
  return null;
}
