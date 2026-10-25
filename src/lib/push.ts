import "server-only";
import webpush from "web-push";
import { isOnline } from "@/lib/chat/rules";
import { orderNumber } from "@/lib/checkout";
import { prisma } from "@/lib/db";

// Notifications (web push). A subscription belongs to a device, so a chat reply reaches that chat's
// device and an order update the device that placed the order: never anyone who only typed the email.

export type PushPayload = { title: string; body: string; url: string; tag?: string; image?: string };
type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };
/** Sends one push; resolves with the push service's HTTP status. */
type Sender = (subscription: Subscription, payload: string) => Promise<number>;

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT ?? "https://bestvapeshopaustralia.com.au";
/** Without the two VAPID settings, nothing is sent and the store hides the notifications button. */
export const pushConfigured = Boolean(PUBLIC_KEY && PRIVATE_KEY);

export const webPushSender: Sender = async (subscription, payload) => {
  try {
    const res = await webpush.sendNotification(subscription, payload, {
      vapidDetails: { subject: SUBJECT, publicKey: PUBLIC_KEY!, privateKey: PRIVATE_KEY! },
      TTL: 24 * 60 * 60, // a phone that's off gets it within a day, or not at all
      timeout: 5_000, // a push service that stops answering is dropped (Node counts it twice: ~10 s)
    });
    return res.statusCode;
  } catch (error) {
    if (error instanceof webpush.WebPushError) return error.statusCode;
    throw error;
  }
};

let sender: Sender | null = pushConfigured ? webPushSender : null;

/** Tests replace the network call. */
export function setPushSender(fn: Sender) {
  sender = fn;
}

/** Saves (or refreshes) a device's subscription. The endpoint is unique per browser. */
export async function savePushSubscription(input: { endpoint: string; keys: { p256dh: string; auth: string }; tokenHash: string; visitorId: string | null; platform: string | null }): Promise<void> {
  const data = { p256dh: input.keys.p256dh, auth: input.keys.auth, deviceTokenHash: input.tokenHash, visitorId: input.visitorId, platform: input.platform };
  await prisma.pushSubscription.upsert({ where: { endpoint: input.endpoint }, create: { endpoint: input.endpoint, ...data }, update: data });
}

type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

/** Sends one payload to these subscriptions; ones the push service says are gone (404/410) are deleted. */
async function sendTo(subs: SubscriptionRow[], payload: PushPayload): Promise<number> {
  if (!sender || !subs.length) return 0;
  const send = sender;
  const body = JSON.stringify(payload);
  const results = await Promise.all(
    subs.map(async (s) => {
      const status = await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body).catch((error) => {
        console.error("push failed", error);
        return 0;
      });
      if (status === 404 || status === 410) await prisma.pushSubscription.deleteMany({ where: { id: s.id } });
      return status >= 200 && status < 300;
    })
  );
  return results.filter(Boolean).length;
}

const subscriptionSelect = { id: true, endpoint: true, p256dh: true, auth: true } as const;

/** Sends to every subscription of these devices. Returns how many were sent. */
export async function pushToDevices(tokenHashes: string[], payload: PushPayload): Promise<number> {
  if (!sender || !tokenHashes.length) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { deviceTokenHash: { in: tokenHashes } }, select: subscriptionSelect });
  return sendTo(subs, payload);
}

/** Sends to every device with notifications on, 100 at a time. Returns how many were sent. */
export async function pushToAll(payload: PushPayload, batchSize = 100): Promise<number> {
  if (!sender) return 0;
  let sent = 0;
  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.pushSubscription.findMany({
      orderBy: { id: "asc" },
      take: batchSize,
      // By id, not Prisma's cursor: a dead last row is deleted before the next page is read.
      ...(cursor ? { where: { id: { gt: cursor } } } : {}),
      select: subscriptionSelect,
    });
    if (!batch.length) return sent;
    cursor = batch[batch.length - 1].id;
    sent += await sendTo(batch, payload);
    if (batch.length < batchSize) return sent;
  }
}

const CHAT_PUSH_GAP_MS = 60_000;

/**
 * After a team message: tell the chat's device, unless the customer is on the site right now (the
 * message icon tells them) or was told less than a minute ago.
 */
export async function notifyChat(conversationId: string): Promise<void> {
  const now = new Date();
  const c = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    select: { deviceTokenHash: true, customerLastSeenAt: true, lastMessagePreview: true },
  });
  if (!c || isOnline(c.customerLastSeenAt, "customer", now)) return;
  // Claimed in one statement, so two quick replies can't both send.
  const { count } = await prisma.chatConversation.updateMany({
    where: { id: conversationId, OR: [{ lastPushAt: null }, { lastPushAt: { lt: new Date(now.getTime() - CHAT_PUSH_GAP_MS) } }] },
    data: { lastPushAt: now },
  });
  if (!count) return;
  await pushToDevices([c.deviceTokenHash], {
    title: "Best Vape Shop",
    body: c.lastMessagePreview || "You have a new message from the team.",
    url: "/account?chat=1",
    tag: `chat-${conversationId}`,
  });
}

const ORDER_NEWS = {
  paid: (n: string) => `Order ${n}: payment received. Thank you!`,
  shipped: (n: string) => `Order ${n} has shipped.`,
  delivered: (n: string) => `Order ${n} has been delivered.`,
} as const;

/** When the team sets an order to paid, shipped or delivered: tell the device that placed it. */
export async function notifyOrder(orderId: string, status: keyof typeof ORDER_NEWS): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { number: true, publicToken: true, access: { where: { fullDetails: true }, select: { tokenHash: true } } },
  });
  if (!order) return;
  await pushToDevices(
    order.access.map((a) => a.tokenHash),
    { title: "Best Vape Shop", body: ORDER_NEWS[status](orderNumber(order.number)), url: `/order/${order.publicToken}`, tag: `order-${orderId}` }
  );
}
