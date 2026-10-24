"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { openAccount } from "@/lib/account";
import { currentVisit } from "@/lib/analytics/record";
import { markAccountInstalled } from "@/lib/app-install";
import { clientIpFrom } from "@/lib/analytics/geo";
import { deviceTokenHashForWrite } from "@/lib/customer-orders";
import { accountLimiter } from "@/lib/rate-limit";

export type OpenAccountResult = { ok: true; email: string } | { ok: false; error: string };

const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email, like name@example.com."));

/**
 * The account icon: an email opens its account (making it the first time) and signs this device in.
 * No password, so every try counts toward a limit, and a new device never sees another device's chat.
 */
export async function openMyAccount(input: { email: string }): Promise<OpenAccountResult> {
  const parsed = emailSchema.safeParse(input?.email ?? "");
  if (!parsed.success) return { ok: false, error: "Enter a valid email, like name@example.com." };
  const email = parsed.data;

  try {
    const ip = clientIpFrom(await headers()) ?? "unknown";
    if (await accountLimiter.isLimited(ip, email)) return { ok: false, error: "Too many tries. Wait 15 minutes, then try again." };
    await accountLimiter.record(ip, email);
    const tokenHash = await deviceTokenHashForWrite();
    const account = await openAccount(tokenHash, email);
    // Signed in inside the installed app: the account gets the app's 10% wherever they order.
    await markAccountInstalled({ visitorId: (await currentVisit()).visitorId, tokenHash }).catch((error) => console.error("mark account installed failed", error));
    return { ok: true, email: account.email };
  } catch (error) {
    console.error("open account failed", error);
    return { ok: false, error: "Something went wrong. Please try again in a moment." };
  }
}
