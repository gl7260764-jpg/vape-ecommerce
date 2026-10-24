import "server-only";
import Pusher from "pusher";

export { channels, EVENTS } from "@/lib/chat/channels";

let client: Pusher | null | undefined;

/** The Pusher server client, or null when the keys aren't set (the chat then runs on polling). */
export function getPusherServer(): Pusher | null {
  if (client !== undefined) return client;
  const { PUSHER_APP_ID: appId, PUSHER_SECRET: secret, NEXT_PUBLIC_PUSHER_KEY: key, NEXT_PUBLIC_PUSHER_CLUSTER: cluster } = process.env;
  client = appId && secret && key && cluster ? new Pusher({ appId, key, secret, cluster, useTLS: true }) : null;
  return client;
}

/**
 * Sends a small "something changed" event. Never throws: the message is already saved,
 * and clients fall back to polling, so a Pusher hiccup only costs a few seconds.
 */
export async function publish(channel: string, event: string, data: unknown): Promise<void> {
  const pusher = getPusherServer();
  if (!pusher) return;
  try {
    await pusher.trigger(channel, event, data);
  } catch (error) {
    console.error(`pusher publish ${channel}/${event} failed`, error);
  }
}
