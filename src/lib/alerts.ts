import "server-only";
import { formatPrice } from "@/lib/catalog";
import { orderNumber } from "@/lib/checkout";
import { prisma } from "@/lib/db";
import { SITE_URL as SITE } from "@/lib/site";

// Phone alerts for the team through ntfy (https://ntfy.sh): new orders, customer messages, enquiries and
// new subscribers land in the ntfy app, and tapping one opens that page in the admin. Anyone who knows a
// topic's name can read it, so alerts carry a first name, a total or a message, never an address or phone.

type Alert = { title: string; message: string; priority: 2 | 4; tags: string[]; click: string };
/** Posts one JSON message to ntfy; rejects if ntfy refuses it or doesn't answer. */
type Transport = (url: string, body: string) => Promise<void>;

const NTFY_URL = process.env.NTFY_URL ?? "https://ntfy.sh"; // or a self-hosted ntfy server

export const ntfyTransport: Transport = async (url, body) => {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new Error(`ntfy answered ${res.status}`);
};

let transport = ntfyTransport;

/** Tests replace the network call. */
export function setAlertTransport(fn: Transport) {
  transport = fn;
}

export async function getAlertTopic(): Promise<string | null> {
  const row = await prisma.storeProfile.findUnique({ where: { id: "store" }, select: { alertTopic: true } });
  return row?.alertTopic ?? null;
}

/** Null turns the alerts off. Callers validate the name (see src/lib/admin/schemas/alerts.ts). */
export async function saveAlertTopic(topic: string | null): Promise<void> {
  await prisma.storeProfile.upsert({ where: { id: "store" }, create: { id: "store", alertTopic: topic }, update: { alertTopic: topic } });
}

/** Sends one alert. Never throws: a missing alert must not stop an order, a message or a sign-up. */
async function send(build: () => Promise<Alert | null>, topic?: string): Promise<boolean> {
  try {
    const to = topic ?? (await getAlertTopic());
    if (!to) return false;
    const alert = await build();
    if (!alert) return false;
    await transport(NTFY_URL, JSON.stringify({ topic: to, ...alert }));
    return true;
  } catch (error) {
    console.error("phone alert failed", error);
    return false;
  }
}

const cut = (text: string, max = 200) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export async function alertNewOrder(orderId: string): Promise<void> {
  await send(async () => {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { number: true, totalCents: true, fullName: true, items: { select: { quantity: true } } } });
    if (!order) return null;
    const count = order.items.reduce((n, i) => n + i.quantity, 0);
    const firstName = order.fullName.trim().split(/\s+/)[0];
    return {
      title: `New order ${orderNumber(order.number)}`,
      message: `${formatPrice(order.totalCents / 100)} from ${firstName} · ${count} ${count === 1 ? "item" : "items"}`,
      priority: 4,
      tags: ["package"],
      click: `${SITE}/admin/orders/${orderId}`,
    };
  });
}

/** A message from a customer (never the team's own replies). */
export async function alertCustomerMessage(conversationId: string, text: string): Promise<void> {
  await send(async () => {
    const chat = await prisma.chatConversation.findUnique({ where: { id: conversationId }, select: { customerName: true, customerEmail: true } });
    if (!chat) return null;
    return {
      title: `Message from ${chat.customerName || chat.customerEmail}`,
      message: cut(text),
      priority: 4,
      tags: ["speech_balloon"],
      click: `${SITE}/admin/chats/${conversationId}`,
    };
  });
}

export async function alertNewSubscriber(email: string): Promise<void> {
  await send(async () => ({ title: "New subscriber", message: email, priority: 2, tags: ["incoming_envelope"], click: `${SITE}/admin/subscribers` }));
}

/** A message from the contact page's form. */
export async function alertNewEnquiry(name: string, message: string): Promise<void> {
  await send(async () => ({ title: `New enquiry from ${name}`, message: cut(message), priority: 4, tags: ["envelope_with_arrow"], click: `${SITE}/admin/enquiries` }));
}

/** From Admin › Settings › Phone alerts. Says whether ntfy took it. */
export async function sendTestAlert(topic: string): Promise<boolean> {
  return send(
    async () => ({
      title: "Phone alerts are on",
      message: "New orders, customer messages and new subscribers will show up here.",
      priority: 4,
      tags: ["white_check_mark"],
      click: `${SITE}/admin`,
    }),
    topic
  );
}
