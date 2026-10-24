// The welcome discount: 10% off the items (not shipping) for subscribing, another 10% for installing
// the app, on the email's next order, once per email. Pure and client-safe.

export const NEWSLETTER_DISCOUNT_PERCENT = 10;
export const APP_DISCOUNT_PERCENT = 10;

/** What the discount takes off, rounded to the cent. */
export const discountCents = (subtotalCents: number, percent: number) => Math.round((subtotalCents * percent) / 100);

/** How the discount line reads for orders saved before discounts had labels (they were all newsletter ones). */
export const DISCOUNT_LABEL = (percent: number) => `Newsletter discount (${percent}%)`;

/** How the discount line reads at checkout, on the order and on the invoice. */
export function discountLabel(newsletter: boolean, app: boolean): string {
  const percent = (newsletter ? NEWSLETTER_DISCOUNT_PERCENT : 0) + (app ? APP_DISCOUNT_PERCENT : 0);
  const what = newsletter && app ? "Newsletter + app discount" : app ? "App discount" : "Newsletter discount";
  return `${what} (${percent}%)`;
}

/** The email's welcome discount, or null when it has none or already used it. */
export function welcomeDiscount(input: { subscribed: boolean; installed: boolean; used: boolean }): { percent: number; label: string } | null {
  if (input.used || (!input.subscribed && !input.installed)) return null;
  const percent = (input.subscribed ? NEWSLETTER_DISCOUNT_PERCENT : 0) + (input.installed ? APP_DISCOUNT_PERCENT : 0);
  return { percent, label: discountLabel(input.subscribed, input.installed) };
}
