import "server-only";
import { prisma } from "@/lib/db";

// Who installed the app. The browser reports "running as the installed app" (it can't be proven,
// and doesn't need to be: the reward is the same one-time 10% installing gives anyway).

/** The customer of the account this device is signed into, if any. */
async function accountCustomerId(tokenHash: string): Promise<string | null> {
  const c = await prisma.chatConversation.findUnique({ where: { deviceTokenHash: tokenHash }, select: { customerId: true } });
  return c?.customerId ?? null;
}

/** Marks the account installed (first time only); false when there's no account to mark. */
async function markCustomer(customerId: string | null): Promise<boolean> {
  if (!customerId) return false;
  await prisma.customer.updateMany({ where: { id: customerId, appInstalledAt: null }, data: { appInstalledAt: new Date() } });
  return true;
}

/**
 * The store ran as the installed app on this device: mark the visitor (first time only) and its account.
 * False while there's no stored visitor yet (the app's very first page writes its analytics cookie a
 * moment after it mounts, and stores the visit after that), so the device tries again.
 */
export async function recordAppInstall(input: { visitorId: string | null; tokenHash: string | null; platform: string }): Promise<boolean> {
  const accountMarked = input.tokenHash ? await markCustomer(await accountCustomerId(input.tokenHash)) : false;
  if (!input.visitorId) return accountMarked;
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

/**
 * What the install offers may say on this device: no discount once its account's welcome discount is
 * used, and no offers at all once the app is installed (by this browser, or by the account elsewhere).
 */
export async function appOffersFor(tokenHash: string | null, visitorId: string | null): Promise<{ welcomeUsed: boolean; signedIn: boolean; installed: boolean }> {
  const [account, visitor] = await Promise.all([
    tokenHash ? prisma.chatConversation.findUnique({ where: { deviceTokenHash: tokenHash }, select: { customerEmail: true, customer: { select: { appInstalledAt: true } } } }) : null,
    visitorId ? prisma.visitor.findUnique({ where: { id: visitorId }, select: { appInstalledAt: true } }) : null,
  ]);
  const used = account ? await prisma.discountRedemption.findUnique({ where: { email: account.customerEmail }, select: { email: true } }) : null;
  return { welcomeUsed: Boolean(used), signedIn: Boolean(account), installed: Boolean(visitor?.appInstalledAt || account?.customer?.appInstalledAt) };
}
