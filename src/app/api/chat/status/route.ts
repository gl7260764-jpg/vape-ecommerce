import { unstable_rethrow } from "next/navigation";
import { customerActor } from "@/lib/chat/access";
import { ensureOrderChats, markReceipts } from "@/lib/chat/service";
import { currentDeviceTokenHash } from "@/lib/customer-orders";
import { prisma } from "@/lib/db";

/**
 * For the store's chat button: does this device have a chat, and how many replies are unread.
 * Checking in also counts as "delivered" for the store's messages, the way a phone gets its ticks
 * once it comes back online.
 */
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    return await status(headers);
  } catch (error) {
    unstable_rethrow(error); // framework signals (prerender, redirects) pass through
    console.error("chat status failed", error);
    return Response.json({ error: "Try again shortly." }, { status: 503, headers });
  }
}

async function status(headers: Record<string, string>) {
  // If the checkout couldn't open this device's chat (a database blink), open it now.
  const tokenHash = await currentDeviceTokenHash();
  if (tokenHash) await ensureOrderChats(tokenHash).catch((error) => console.error("chat recovery failed", error));
  const actor = await customerActor();
  if (!actor) return Response.json({ hasConversation: false, unread: 0, conversationId: null }, { headers });
  const conversation = await prisma.chatConversation.findUnique({ where: { id: actor.conversationId }, select: { customerUnreadCount: true } });
  await markReceipts(actor, { conversationId: actor.conversationId, kind: "delivered", upTo: new Date().toISOString() }).catch((error) =>
    console.error("chat delivered receipts failed", error)
  );
  return Response.json({ hasConversation: true, unread: conversation?.customerUnreadCount ?? 0, conversationId: actor.conversationId }, { headers });
}
