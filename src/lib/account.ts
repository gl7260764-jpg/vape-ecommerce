import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { announceInbox, ensureOrderChats } from "@/lib/chat/service";
import { prisma } from "@/lib/db";

// Accounts without passwords. An email opens one on this device: the device gets its own chat with
// the team and that email's orders as summaries. Typing an email proves nothing, so a device never
// sees messages, invoices or full order details made on another device.

const normalise = (email: string) => email.trim().toLowerCase();
const isUnique = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

async function customerFor(email: string) {
  const args = { where: { email }, create: { email }, update: {}, select: { id: true, name: true } };
  try {
    return await prisma.customer.upsert(args);
  } catch (error) {
    if (isUnique(error)) return prisma.customer.upsert(args); // the same email opened twice at once
    throw error;
  }
}

/** Every order placed with this email, added to this device as summaries. Never downgrades the device's own orders. */
export async function addOrderSummaries(tokenHash: string, email: string): Promise<void> {
  const orders = await prisma.order.findMany({
    where: { email: { equals: normalise(email), mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true },
  });
  if (!orders.length) return;
  await prisma.orderAccess.createMany({ data: orders.map((o) => ({ tokenHash, orderId: o.id, fullDetails: false })), skipDuplicates: true });
}

/**
 * Opens the account for this email (creating it if needed) and signs this device into it. A device
 * already signed in stays in its account: isNew is false and email is the account it's in.
 */
export async function openAccount(tokenHash: string, email: string): Promise<{ conversationId: string; email: string; isNew: boolean }> {
  const e = normalise(email);
  const customer = await customerFor(e);
  const signedIn = { id: true, customerEmail: true } as const;
  const existing = await prisma.chatConversation.findUnique({ where: { deviceTokenHash: tokenHash }, select: signedIn });
  if (existing) return { conversationId: existing.id, email: existing.customerEmail, isNew: false };

  let conversationId: string;
  try {
    ({ id: conversationId } = await prisma.chatConversation.create({
      data: { deviceTokenHash: tokenHash, customerId: customer.id, customerEmail: e, customerName: customer.name ?? e },
      select: { id: true },
    }));
  } catch (error) {
    if (!isUnique(error)) throw error;
    // Two sign-ins from this device at once: the other one won.
    const won = await prisma.chatConversation.findUniqueOrThrow({ where: { deviceTokenHash: tokenHash }, select: signedIn });
    return { conversationId: won.id, email: won.customerEmail, isNew: false };
  }
  await addOrderSummaries(tokenHash, e);
  await announceInbox(conversationId).catch((error) => console.error("new account inbox update failed", error));
  return { conversationId, email: e, isNew: true };
}

/**
 * The account this device is signed into, with its chat's latest message and unread count. A device
 * that just ordered is signed in even if the checkout hasn't opened its chat yet: it's opened here.
 */
export async function accountForDevice(tokenHash: string): Promise<{ email: string; conversationId: string; lastMessagePreview: string; unread: number } | null> {
  const read = () =>
    prisma.chatConversation.findUnique({
      where: { deviceTokenHash: tokenHash },
      select: { id: true, customerEmail: true, lastMessagePreview: true, customerUnreadCount: true },
    });
  let c = await read();
  if (!c) {
    await ensureOrderChats(tokenHash);
    c = await read();
  }
  return c ? { email: c.customerEmail, conversationId: c.id, lastMessagePreview: c.lastMessagePreview, unread: c.customerUnreadCount } : null;
}
