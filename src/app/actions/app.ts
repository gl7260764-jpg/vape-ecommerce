"use server";

import { after } from "next/server";
import { recordAppInstall } from "@/lib/app-install";
import { currentVisit, recordServerEvent } from "@/lib/analytics/record";
import { currentDeviceTokenHash } from "@/lib/customer-orders";

const PLATFORM = /^[A-Za-z]{2,12}$/; // "iPhone", "Android", "Mac", "Windows"…

/** The store is running as the installed app on this device: remember it (once) for the app's 10% and the team. */
export async function recordInstall(input: { platform: string }): Promise<{ ok: boolean }> {
  const platform = String(input?.platform ?? "");
  if (!PLATFORM.test(platform)) return { ok: false };
  try {
    const visit = await currentVisit();
    const recorded = await recordAppInstall({ visitorId: visit.visitorId, tokenHash: await currentDeviceTokenHash(), platform });
    if (recorded) after(() => recordServerEvent({ ...visit, type: "install_app", path: "/", label: platform }));
    return { ok: recorded };
  } catch (error) {
    console.error("record app install failed", error);
    return { ok: false };
  }
}
