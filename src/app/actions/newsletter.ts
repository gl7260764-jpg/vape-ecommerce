"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { openAccount } from "@/lib/account";
import { alertNewSubscriber } from "@/lib/alerts";
import { markAccountInstalled } from "@/lib/app-install";
import { clientIpFrom } from "@/lib/analytics/geo";
import { currentVisit, existingVisitorId, recordServerEvent } from "@/lib/analytics/record";
import { deviceTokenHashForWrite } from "@/lib/customer-orders";
import { subscribeEmail } from "@/lib/newsletter";
import { accountLimiter } from "@/lib/rate-limit";

export type SubscribeState = { status: "idle" | "invalid" | "failed" | "done" };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Subscribing opens the subscriber's account on this device, within the account icon's limit (it
// shows order summaries). Past the limit, or if it fails, the subscription still counts.
async function openAccountAfterSubscribe(email: string) {
  try {
    const ip = clientIpFrom(await headers()) ?? "unknown";
    if (await accountLimiter.isLimited(ip, email)) return;
    await accountLimiter.record(ip, email);
    const tokenHash = await deviceTokenHashForWrite();
    await openAccount(tokenHash, email);
    await markAccountInstalled({ visitorId: (await currentVisit()).visitorId, tokenHash });
  } catch (error) {
    console.error("account after subscribe failed", error);
  }
}

/** Saves a newsletter signup and opens their account on this device. Re-subscribing the same address is a no-op, not an error. */
export async function subscribe(_previous: SubscribeState, formData: FormData): Promise<SubscribeState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return { status: "invalid" };

  try {
    const visit = await currentVisit();
    const visitorId = await existingVisitorId(visit.visitorId).catch(() => null);
    const { isNew } = await subscribeEmail(email, "footer", visitorId);
    if (isNew) after(() => alertNewSubscriber(email));
    await openAccountAfterSubscribe(email);
    after(() => recordServerEvent({ ...visit, type: "subscribe", path: "/", label: "Newsletter", email }));
    return { status: "done" };
  } catch (error) {
    console.error("newsletter subscribe failed", error);
    return { status: "failed" };
  }
}

export type PopupSubscribeResult = { ok: true; discount: "saved" | "used" } | { ok: false; error: string };

/** The pop-up's sign-up. Says whether the 10% is waiting, or was already spent on an earlier order. */
export async function subscribeFromPopup(input: { email: string }): Promise<PopupSubscribeResult> {
  const email = String(input?.email ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return { ok: false, error: "Enter a valid email, like name@example.com." };

  try {
    const visit = await currentVisit();
    const visitorId = await existingVisitorId(visit.visitorId).catch(() => null);
    const { discount, isNew } = await subscribeEmail(email, "popup", visitorId);
    if (isNew) after(() => alertNewSubscriber(email));
    await openAccountAfterSubscribe(email);
    after(() => recordServerEvent({ ...visit, type: "subscribe", path: "/", label: "Newsletter pop-up", email }));
    return { ok: true, discount };
  } catch (error) {
    console.error("newsletter pop-up subscribe failed", error);
    return { ok: false, error: "We couldn't save that just now. Please try again." };
  }
}
