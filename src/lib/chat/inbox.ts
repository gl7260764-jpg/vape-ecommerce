import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ConversationDTO } from "@/lib/chat/types";

// The admin's view of chats: the inbox list and the details beside a conversation. Callers check
// requireAdmin() first.

const conversationSelect = {
  id: true,
  customerName: true,
  customerEmail: true,
  lastMessageAt: true,
  lastMessagePreview: true,
  staffUnreadCount: true,
  customerUnreadCount: true,
  customerLastSeenAt: true,
  // An order placed on the device puts its card (a system message with the order) in the chat.
  _count: { select: { messages: { where: { sender: "system", orderId: { not: null } } } } },
} satisfies Prisma.ChatConversationSelect;

type ConversationRow = Prisma.ChatConversationGetPayload<{ select: typeof conversationSelect }>;

/** Rows to DTOs. A chat whose device never ordered is tagged, Subscriber when its email is subscribed. */
async function toConversationDTOs(rows: ConversationRow[]): Promise<ConversationDTO[]> {
  const unproven = rows.filter((c) => c._count.messages === 0).map((c) => c.customerEmail);
  const subscribed = new Set(
    unproven.length ? (await prisma.subscriber.findMany({ where: { email: { in: unproven } }, select: { email: true } })).map((s) => s.email) : []
  );
  return rows.map(({ _count, ...c }) => ({
    ...c,
    lastMessageAt: c.lastMessageAt.toISOString(),
    customerLastSeenAt: c.customerLastSeenAt?.toISOString() ?? null,
    tag: _count.messages > 0 ? null : subscribed.has(c.customerEmail) ? "Subscriber" : "New account",
  }));
}

/** Most recent first, at most 100. `q` matches the name, the email or an order number ("BV-10053" or "10053"). */
export async function listInbox({ q, unread }: { q?: string; unread?: boolean } = {}): Promise<{ conversations: ConversationDTO[]; unreadTotal: number }> {
  const text = q?.trim().slice(0, 100) ?? "";
  const number = /^(?:bv-?)?(\d{1,9})$/i.exec(text)?.[1];
  const where: Prisma.ChatConversationWhereInput = {
    ...(text && {
      OR: [
        { customerName: { contains: text, mode: "insensitive" } },
        { customerEmail: { contains: text, mode: "insensitive" } },
        ...(number ? [{ messages: { some: { order: { number: Number(number) } } } }] : []),
      ],
    }),
    ...(unread && { staffUnreadCount: { gt: 0 } }),
  };
  const [rows, total] = await Promise.all([
    prisma.chatConversation.findMany({ where, orderBy: { lastMessageAt: "desc" }, take: 100, select: conversationSelect }),
    prisma.chatConversation.aggregate({ _sum: { staffUnreadCount: true } }),
  ]);
  return { conversations: await toConversationDTOs(rows), unreadTotal: total._sum.staffUnreadCount ?? 0 };
}

export async function getConversation(id: string): Promise<ConversationDTO | null> {
  const row = await prisma.chatConversation.findUnique({ where: { id }, select: conversationSelect });
  return row ? (await toConversationDTOs([row]))[0]! : null;
}

export type ContextOrder = { id: string; number: number; totalCents: number; status: string; paymentMethod: string; createdAt: string };

/** Beside a conversation: every order for the customer's email, their phone, and the visitor who ordered. */
export async function conversationContext(id: string): Promise<{ orders: ContextOrder[]; visitorId: string | null; phone: string | null } | null> {
  const conversation = await prisma.chatConversation.findUnique({ where: { id }, select: { customerEmail: true } });
  if (!conversation) return null;
  const [orders, latestCard] = await Promise.all([
    prisma.order.findMany({
      where: { email: { equals: conversation.customerEmail, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, number: true, totalCents: true, status: true, paymentMethod: true, createdAt: true, phone: true },
    }),
    // The orders placed from this device carry the analytics visitor.
    prisma.chatMessage.findFirst({
      where: { conversationId: id, order: { visitorId: { not: null } } },
      orderBy: { createdAt: "desc" },
      select: { order: { select: { visitorId: true } } },
    }),
  ]);
  return {
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      totalCents: o.totalCents,
      status: o.status,
      paymentMethod: o.paymentMethod,
      createdAt: o.createdAt.toISOString(),
    })),
    visitorId: latestCard?.order?.visitorId ?? null,
    phone: orders[0]?.phone ?? null,
  };
}
