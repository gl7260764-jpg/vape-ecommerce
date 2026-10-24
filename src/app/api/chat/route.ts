import { unstable_rethrow } from "next/navigation";
import { customerActor } from "@/lib/chat/access";
import { storeStatus } from "@/lib/chat/presence";
import { ChatError, listMessages, syncFrom } from "@/lib/chat/service";
import { prisma } from "@/lib/db";

const noStore = { "Cache-Control": "private, no-store" };

/**
 * The customer's conversation. No params: the newest 200 messages. `changedSince=<now from the last
 * sync>`: only what changed (10 s of overlap so nothing committed mid-sync is missed). `before=`: older.
 */
export async function GET(request: Request) {
  const actor = await customerActor();
  if (!actor) return Response.json({ error: "No chat on this device." }, { status: 404, headers: noStore });
  const params = new URL(request.url).searchParams;
  const changedSince = params.get("changedSince");
  const before = params.get("before");
  const now = new Date().toISOString(); // taken before reading, so the next sync starts from here
  try {
    const [messages, conversation, store] = await Promise.all([
      listMessages(actor.conversationId, actor, {
        changedSince: changedSince ? syncFrom(changedSince) : undefined,
        before: before ?? undefined,
      }),
      prisma.chatConversation.findUnique({ where: { id: actor.conversationId }, select: { id: true, customerUnreadCount: true } }),
      storeStatus(),
    ]);
    return Response.json({ now, conversation, store, messages }, { headers: noStore });
  } catch (error) {
    if (error instanceof ChatError && error.code === "INVALID") return Response.json({ error: "Bad request." }, { status: 400, headers: noStore });
    // The database blinked: the chat polls again in a few seconds.
    unstable_rethrow(error); // framework signals (prerender, redirects) pass through
    console.error("customer chat sync failed", error);
    return Response.json({ error: "The chat couldn't load. Trying again shortly." }, { status: 503, headers: noStore });
  }
}
