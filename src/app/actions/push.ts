"use server";

import { after } from "next/server";
import { z } from "zod";
import { currentVisit, existingVisitorId, recordServerEvent } from "@/lib/analytics/record";
import { currentDeviceTokenHash, deviceTokenHashForWrite } from "@/lib/customer-orders";
import { prisma } from "@/lib/db";
import { savePushSubscription } from "@/lib/push";

// A push subscription as the browser gives it (PushSubscription.toJSON()).
const subscriptionInput = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({
    p256dh: z.string().regex(/^[\w-]{80,100}$/),
    auth: z.string().regex(/^[\w-]{16,30}$/),
  }),
  platform: z.string().regex(/^[A-Za-z]{2,12}$/),
});

/** "Turn on notifications": saves this device's subscription, so its chat replies and order updates reach it. */
export async function enableNotifications(input: z.input<typeof subscriptionInput>): Promise<{ ok: boolean }> {
  const parsed = subscriptionInput.safeParse(input);
  if (!parsed.success) return { ok: false };
  try {
    const visit = await currentVisit();
    const visitorId = await existingVisitorId(visit.visitorId).catch(() => null);
    await savePushSubscription({ ...parsed.data, tokenHash: await deviceTokenHashForWrite(), visitorId });
    after(() => recordServerEvent({ ...visit, type: "enable_notifications", path: "/", label: parsed.data.platform }));
    return { ok: true };
  } catch (error) {
    console.error("enable notifications failed", error);
    return { ok: false };
  }
}

/** "Turn off": forgets this browser's subscription (only ever this device's own). */
export async function disableNotifications(input: { endpoint: string }): Promise<{ ok: boolean }> {
  const endpoint = String(input?.endpoint ?? "").slice(0, 1000);
  try {
    const tokenHash = await currentDeviceTokenHash();
    if (tokenHash && endpoint) await prisma.pushSubscription.deleteMany({ where: { endpoint, deviceTokenHash: tokenHash } });
    return { ok: true };
  } catch (error) {
    console.error("disable notifications failed", error);
    return { ok: false };
  }
}
