import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isInstalled } from "@/lib/app-install";
import { welcomeDiscount } from "@/lib/discount";

// Subscribers, the one-time welcome discount, and how the pop-up behaves. Callers check permissions.

const normalise = (email: string) => email.trim().toLowerCase();

/**
 * The email's welcome discount for its next order: 10% if subscribed, 10% more if the app is installed
 * (on this device or by the email's account), nothing once the email has used it.
 */
export async function welcomeDiscountFor(email: string, visitorId: string | null): Promise<{ percent: number; label: string } | null> {
  const e = normalise(email);
  if (!e) return null;
  const [subscriber, used, installed] = await Promise.all([
    prisma.subscriber.findUnique({ where: { email: e }, select: { id: true } }),
    prisma.discountRedemption.findUnique({ where: { email: e }, select: { email: true } }),
    isInstalled({ visitorId, email: e }),
  ]);
  return welcomeDiscount({ subscribed: Boolean(subscriber), installed, used: Boolean(used) });
}

/**
 * Uses the email's discount inside the transaction that creates the order. The email is the key,
 * so of two orders at once only one gets it: the other's insert is skipped and this returns false.
 */
export async function claimDiscount(tx: Prisma.TransactionClient, email: string, orderId: string | null, percent: number): Promise<boolean> {
  const { count } = await tx.discountRedemption.createMany({ data: [{ email: normalise(email), orderId, percent }], skipDuplicates: true });
  return count === 1;
}

/**
 * Adds (or keeps) a subscriber and says whether their 10% is still waiting or was already used, and
 * whether the email is new (the team is alerted once per subscriber).
 */
export async function subscribeEmail(email: string, source: "footer" | "popup" | "admin", visitorId: string | null): Promise<{ discount: "saved" | "used"; isNew: boolean }> {
  const e = normalise(email);
  const { count } = await prisma.subscriber.createMany({ data: [{ email: e, source, visitorId }], skipDuplicates: true });
  if (!count && visitorId) await prisma.subscriber.update({ where: { email: e }, data: { visitorId } });
  const used = await prisma.discountRedemption.findUnique({ where: { email: e }, select: { email: true } });
  return { discount: used ? "used" : "saved", isNew: count === 1 };
}

export type NewsletterSettingsValues = {
  popupEnabled: boolean;
  firstDelaySeconds: number;
  repeatEverySeconds: number;
  maxShows: number | null;
  /** The app install card, navbar icon and pop-up (the pop-up uses the timing above). */
  installOffersEnabled: boolean;
};

// Once a day and at most twice: a pop-up that comes back every few seconds counts against the page in Google
// (intrusive interstitials) and annoys shoppers.
export const NEWSLETTER_DEFAULTS: NewsletterSettingsValues = { popupEnabled: true, firstDelaySeconds: 8, repeatEverySeconds: 86_400, maxShows: 2, installOffersEnabled: true };

/** The pop-up's settings for every store page. Cached; saving them expires the "newsletter" tag. */
export async function getNewsletterSettings(): Promise<NewsletterSettingsValues> {
  "use cache";
  cacheTag("newsletter");
  cacheLife("minutes");
  const row = await prisma.newsletterSettings.findUnique({
    where: { id: "newsletter" },
    select: { popupEnabled: true, firstDelaySeconds: true, repeatEverySeconds: true, maxShows: true, installOffersEnabled: true },
  });
  return row ?? NEWSLETTER_DEFAULTS;
}

export async function saveNewsletterSettings(values: NewsletterSettingsValues): Promise<void> {
  await prisma.newsletterSettings.upsert({ where: { id: "newsletter" }, create: { id: "newsletter", ...values }, update: values });
}
