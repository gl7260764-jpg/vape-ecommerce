import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { InvoiceSnapshot } from "@/lib/invoices/types";
import { mediaUrl } from "@/lib/catalog";

// Accounts without passwords: a private, httpOnly cookie identifies this browser. Orders placed
// here show in full; orders found here by email show as a summary (no street address, phone or
// order link), because typing an email doesn't prove it's yours.

const COOKIE = "bvsa_orders";
const MAX_AGE = 400 * 86_400; // the longest browsers allow
const TOKEN = /^[\w-]{40,64}$/;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

async function readToken() {
  const token = (await cookies()).get(COOKIE)?.value;
  return token && TOKEN.test(token) ? token : null;
}

/** This browser's token, creating and setting the cookie the first time. Server actions only. */
async function ensureToken() {
  const token = (await readToken()) ?? randomBytes(32).toString("base64url");
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE });
  return token;
}

/** The order was placed on this browser: show it here in full. Returns the device's token hash. */
export async function grantOrderAccess(orderId: string) {
  const tokenHash = hash(await ensureToken());
  await prisma.orderAccess.upsert({
    where: { tokenHash_orderId: { tokenHash, orderId } },
    create: { tokenHash, orderId, fullDetails: true },
    update: { fullDetails: true },
  });
  return tokenHash;
}

/** This browser's device id (hashed), setting the cookie the first time. Server actions only. */
export async function deviceTokenHashForWrite() {
  return hash(await ensureToken());
}

/** This browser's device id (hashed), or null if it has never placed or found an order. */
export async function currentDeviceTokenHash() {
  const token = await readToken();
  return token ? hash(token) : null;
}

/** Removes every order from this browser's list and drops its cookie (for shared computers). */
export async function forgetThisDevice() {
  const jar = await cookies();
  const token = await readToken();
  if (token) await prisma.orderAccess.deleteMany({ where: { tokenHash: hash(token) } });
  jar.delete({ name: COOKIE, path: "/" });
}

/** The orders this browser may show, newest first. */
export async function ordersForThisDevice() {
  const token = await readToken();
  if (!token) return [];
  const rows = await prisma.orderAccess.findMany({
    where: { tokenHash: hash(token) },
    orderBy: { order: { createdAt: "desc" } },
    take: 100,
    select: {
      fullDetails: true,
      order: {
        select: {
          id: true,
          number: true,
          publicToken: true,
          status: true,
          paymentMethod: true,
          email: true,
          totalCents: true,
          shippingName: true,
          createdAt: true,
          suburb: true,
          state: true,
          items: { orderBy: { id: "asc" }, select: { id: true, name: true, quantity: true, imageKey: true } },
          invoices: { orderBy: { version: "desc" }, take: 1, select: { snapshot: true } },
        },
      },
    },
  });
  return rows.map(({ order: { invoices, ...order }, fullDetails }) => {
    // Once invoiced, the customer sees what was last sent to them, not edits the team hasn't sent.
    const sent = invoices[0]?.snapshot as InvoiceSnapshot | undefined;
    const shown = sent
      ? {
          ...order,
          totalCents: sent.totalCents,
          shippingName: sent.shipTo.shippingName,
          suburb: sent.shipTo.suburb,
          state: sent.shipTo.state as typeof order.state,
          paymentMethod: sent.paymentMethod,
          items: sent.items.map((i, n) => ({ id: `sent-${n}`, name: i.name, quantity: i.quantity, imageKey: i.imageKey })),
        }
      : order;
    return {
      ...shown,
      fullDetails,
      hasInvoice: Boolean(sent),
      // A summary never carries the private order link or the suburb.
      publicToken: fullDetails ? order.publicToken : null,
      suburb: fullDetails ? shown.suburb : null,
      items: shown.items.map((i) => ({ ...i, image: i.imageKey ? mediaUrl(i.imageKey) : null })),
    };
  });
}

export type DeviceOrder = Awaited<ReturnType<typeof ordersForThisDevice>>[number];

/** Words customers understand for each order status. */
export const CUSTOMER_STATUS: Record<DeviceOrder["status"], { label: string; tone: "warning" | "info" | "success" | "danger" }> = {
  pending_payment: { label: "Awaiting payment", tone: "warning" },
  paid: { label: "Payment received", tone: "info" },
  processing: { label: "Being packed", tone: "info" },
  shipped: { label: "On its way", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};
