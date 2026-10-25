"use client";

import { useEffect, useState } from "react";
import { BellRingingIcon, XIcon } from "@phosphor-icons/react";
import { useNotifications } from "@/components/app/use-notifications";

const ASKED_KEY = "bvsa-chat-notify-asked";

/** In the chat, once: "Get notified when we reply", so someone who leaves still hears back (where the browser can). */
export function NotifyBanner() {
  const { state, turnOn } = useNotifications();
  const [asked, setAsked] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is only readable after mount
      setAsked(window.localStorage.getItem(ASKED_KEY) === "yes");
    } catch {
      setAsked(false);
    }
  }, []);
  if (asked || state !== "off") return null;
  const done = () => {
    setAsked(true);
    try {
      window.localStorage.setItem(ASKED_KEY, "yes");
    } catch {
      // storage blocked: asked again next time
    }
  };
  return (
    <div className="flex items-center gap-2 border-b border-border bg-primary/8 px-3 py-2 text-sm">
      <BellRingingIcon className="size-4 shrink-0 text-primary-ink" aria-hidden />
      <p className="min-w-0 flex-1">Get notified about replies, orders and new products</p>
      <button
        type="button"
        onClick={() => {
          done();
          void turnOn();
        }}
        className="h-8 shrink-0 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground"
      >
        Turn on
      </button>
      <button type="button" onClick={done} aria-label="Not now" className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-surface-2">
        <XIcon className="size-4" aria-hidden />
      </button>
    </div>
  );
}
