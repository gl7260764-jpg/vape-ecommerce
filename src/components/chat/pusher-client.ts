"use client";

import type Pusher from "pusher-js";
import type { Channel } from "pusher-js";
import type { ChatSide } from "@/lib/chat/types";

// One Pusher connection per side, loaded on demand so pusher-js stays out of the store's first load.
// Without NEXT_PUBLIC_PUSHER_KEY/CLUSTER there is no connection at all and the chat polls instead.

const instances: Partial<Record<ChatSide, Promise<Pusher | null>>> = {};

export const pusherConfigured = Boolean(process.env.NEXT_PUBLIC_PUSHER_KEY && process.env.NEXT_PUBLIC_PUSHER_CLUSTER);

export function getPusher(side: ChatSide): Promise<Pusher | null> {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) return Promise.resolve(null);
  instances[side] ??= import("pusher-js")
    .then(
      ({ default: PusherClient }) =>
        new PusherClient(key, {
          cluster,
          channelAuthorization: { endpoint: side === "customer" ? "/api/pusher/auth" : "/admin/api/pusher/auth", transport: "ajax" },
        })
    )
    .catch(() => null);
  return instances[side]!;
}

/** The connection if it was ever opened, without opening one. */
export function peekPusher(side: ChatSide): Promise<Pusher | null> {
  return instances[side] ?? Promise.resolve(null);
}

const holders = new Map<string, number>();

/**
 * Listens on a channel; several components can share one. The channel is left once the last
 * listener goes. Returns the cleanup.
 */
export function listen(pusher: Pusher, name: string, handlers: Record<string, (data: unknown) => void>): { channel: Channel; stop: () => void } {
  const channel = pusher.channel(name) ?? pusher.subscribe(name);
  holders.set(name, (holders.get(name) ?? 0) + 1);
  for (const [event, fn] of Object.entries(handlers)) channel.bind(event, fn);
  return {
    channel,
    stop: () => {
      for (const [event, fn] of Object.entries(handlers)) channel.unbind(event, fn);
      const left = (holders.get(name) ?? 1) - 1;
      if (left <= 0) {
        holders.delete(name);
        pusher.unsubscribe(name);
      } else holders.set(name, left);
    },
  };
}
