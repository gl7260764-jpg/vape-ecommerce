import "server-only";
import { prisma } from "@/lib/db";
import { currentDeviceTokenHash } from "@/lib/customer-orders";

/**
 * The customer chatting from this device, or null. A device has a conversation once it is signed
 * into an account (by ordering, subscribing or typing its email), and only ever reaches its own.
 */
export async function actorForDevice(tokenHash: string): Promise<{ kind: "customer"; conversationId: string } | null> {
  const conversation = await prisma.chatConversation.findUnique({ where: { deviceTokenHash: tokenHash }, select: { id: true } });
  return conversation ? { kind: "customer", conversationId: conversation.id } : null;
}

/** The customer chatting from this browser, or null. */
export async function customerActor(): Promise<{ kind: "customer"; conversationId: string } | null> {
  const tokenHash = await currentDeviceTokenHash();
  return tokenHash ? actorForDevice(tokenHash) : null;
}
