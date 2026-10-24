import "server-only";
import { prisma } from "@/lib/db";
import { isOnline, ONLINE_MS } from "@/lib/chat/rules";
import { channels, EVENTS, publish } from "@/lib/chat/realtime";

// "Online" and "last seen". Open tabs send a heartbeat every 25 s; the server only publishes when
// someone goes from offline to online (or leaves), so steady heartbeats cost no Pusher messages.

/** A customer tab is open. Publishes to the admin inbox when they come online. */
export async function customerHeartbeat(conversationId: string) {
  const now = new Date();
  const prev = await prisma.chatConversation.findUnique({ where: { id: conversationId }, select: { customerLastSeenAt: true } });
  await prisma.chatConversation.update({ where: { id: conversationId }, data: { customerLastSeenAt: now } });
  if (!isOnline(prev?.customerLastSeenAt ?? null, "customer", now)) await publish(channels.inbox, EVENTS.inbox, { conversationId });
}

/** The customer closed their last tab: show them offline now rather than in 45 s. */
export async function customerLeft(conversationId: string) {
  const lastSeen = new Date(Date.now() - ONLINE_MS.customer - 1000);
  await prisma.chatConversation.update({ where: { id: conversationId }, data: { customerLastSeenAt: lastSeen } });
  await publish(channels.inbox, EVENTS.inbox, { conversationId });
}

/** Whether anyone on the team is online, and when they were last around. */
export async function storeStatus(): Promise<{ online: boolean; lastSeenAt: string | null }> {
  const latest = await prisma.chatPresence.findFirst({ where: { id: { startsWith: "staff:" } }, orderBy: { lastSeenAt: "desc" }, select: { lastSeenAt: true } });
  return { online: isOnline(latest?.lastSeenAt ?? null, "staff", new Date()), lastSeenAt: latest?.lastSeenAt.toISOString() ?? null };
}

/** An admin tab is open. Tells customers' chats when the store comes online. */
export async function staffHeartbeat(adminId: string) {
  const before = await storeStatus();
  await prisma.chatPresence.upsert({ where: { id: `staff:${adminId}` }, create: { id: `staff:${adminId}`, lastSeenAt: new Date() }, update: { lastSeenAt: new Date() } });
  if (!before.online) await publish(channels.store, EVENTS.presence, await storeStatus());
}

/** An admin closed their last tab. */
export async function staffLeft(adminId: string) {
  const lastSeen = new Date(Date.now() - ONLINE_MS.staff - 1000);
  await prisma.chatPresence.upsert({ where: { id: `staff:${adminId}` }, create: { id: `staff:${adminId}`, lastSeenAt: lastSeen }, update: { lastSeenAt: lastSeen } });
  await publish(channels.store, EVENTS.presence, await storeStatus());
}
