import "server-only";
import { prisma } from "@/lib/db";

// Who installed the app. The browser reports "running as the installed app" (it can't be proven,
// and doesn't need to be: the reward is the same one-time 10% installing gives anyway).

/** The customer of the account this device is signed into, if any. */
async function accountCustomerId(tokenHash: string): Promise<string | null> {
  const c = await prisma.chatConversation.findUnique({ where: { deviceTokenHash: tokenHash }, select: { customerId: true } });
  return c?.customerId ?? null;
}

async function markCustomer(customerId: string | null) {
  if (customerId) await prisma.customer.updateMany({ where: { id: customerId, appInstalledAt: null }, data: { appInstalledAt: new Date() } });
}

/**
 * The store ran as the installed app on this device: mark the visitor (first time only) and its account.
 * False when the visitor isn't stored yet (the app's first page view can arrive after this), so the
 * device tries again; true once it's recorded, or when tracking is off and there's no visitor to mark.
 */
export async function recordAppInstall(input: { visitorId: string | null; tokenHash: string | null; platform: string }): Promise<boolean> {
  if (input.tokenHash) await markCustomer(await accountCustomerId(input.tokenHash));
  if (!input.visitorId) return true;
  const { count } = await prisma.visitor.updateMany({
    where: { id: input.visitorId, appInstalledAt: null },
    data: { appInstalledAt: new Date(), appPlatform: input.platform.slice(0, 40) },
  });
  if (count) return true;
  const v = await prisma.visitor.findUnique({ where: { id: input.visitorId }, select: { appInstalledAt: true } });
  return Boolean(v?.appInstalledAt);
}

/** After signing in or subscribing: an installed device makes its account installed too (so the 20% works anywhere). */
export async function markAccountInstalled(input: { visitorId: string | null; tokenHash: string }): Promise<void> {
  if (!input.visitorId) return;
  const v = await prisma.visitor.findUnique({ where: { id: input.visitorId }, select: { appInstalledAt: true } });
  if (v?.appInstalledAt) await markCustomer(await accountCustomerId(input.tokenHash));
}

/** For the app 10% at checkout: this device installed the app, or the email's account did. */
export async function isInstalled(input: { visitorId: string | null; email: string }): Promise<boolean> {
  const email = input.email.trim().toLowerCase();
  const [visitor, customer] = await Promise.all([
    input.visitorId ? prisma.visitor.findUnique({ where: { id: input.visitorId }, select: { appInstalledAt: true } }) : null,
    email ? prisma.customer.findUnique({ where: { email }, select: { appInstalledAt: true } }) : null,
  ]);
  return Boolean(visitor?.appInstalledAt || customer?.appInstalledAt);
}

/** What the install offers may promise this device: no discount once its account's welcome discount is used. */
export async function appOffersFor(tokenHash: string | null): Promise<{ welcomeUsed: boolean; signedIn: boolean }> {
  if (!tokenHash) return { welcomeUsed: false, signedIn: false };
  const c = await prisma.chatConversation.findUnique({ where: { deviceTokenHash: tokenHash }, select: { customerEmail: true } });
  if (!c) return { welcomeUsed: false, signedIn: false };
  const used = await prisma.discountRedemption.findUnique({ where: { email: c.customerEmail }, select: { email: true } });
  return { welcomeUsed: Boolean(used), signedIn: true };
}
