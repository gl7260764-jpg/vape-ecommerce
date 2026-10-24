# Newsletter Pop-up and Subscriber Discount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A newsletter pop-up that comes back on admin-set rules until the visitor subscribes, and 10% off each subscriber's next order, shown at checkout and on the invoice.

**Architecture:**
- **The discount is decided on the server.** A subscriber (by email) with no row in `DiscountRedemption` qualifies. Placing the order creates that row in the same transaction as the order, so the email's primary key makes a second claim impossible.
- **The order keeps the discount** as `discountPercent` and `discountCents`, so edits, invoices and every page compute the same total.
- **The pop-up is a small client trigger in the store layout.** It reads the cached settings and the device's state in the browser, and loads the dialog only when it's about to show.

**Tech Stack:** Next.js 16.4 (App Router, cacheComponents, `"use cache"` + `cacheTag`/`updateTag`), React 19, Prisma 7 on Neon, zod 4, Tailwind v4, radix-ui, Phosphor icons. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-24-newsletter-popup-design.md` (mockup: `.superpowers/brainstorm/1936979-1792775812/content/newsletter-popup.html`)

## Global Constraints

- **No git:** tasks end with a verification checkpoint and a ledger line.
- **Conventions (`ADMIN-BLUEPRINT.md`):**
  - `requireAdmin()` first in every admin action and route; pages call `requireAdminPage()`; `ActionResult`.
  - Settings need `settings:write` (owner).
  - No em dashes. One accent (`--primary`). Pill buttons. Light and dark mode.
- **Simplicity (owner):** the plainest version of each feature.
- **Money:**
  - integer cents
  - `discountCents = Math.round(itemsSubtotalCents × percent / 100)`, with `percent = 10`
  - `totalCents = subtotalCents − discountCents + shippingCents`
  - GST shown = `Math.round(totalCents / 11)`
- **Copy from the spec:**
  - Pop-up: eyebrow "NEWSLETTER"; heading "Get 10% off your next order"; body "Subscribe for new releases, restocks and deals. Your 10% is applied automatically at checkout."
  - Pop-up buttons and fine print: "Subscribe and save 10%"; "No thanks"; ✕; "One discount per email. Unsubscribe any time."
  - Success: "You're in! 10% off your next order is saved to <email>. Use that email at checkout and it comes off automatically." with a "Start shopping" button.
  - Discount already used: "You're subscribed. Your 10% welcome discount was already used on an earlier order."
  - Order line: "Newsletter discount (10%)".
- **Pop-up rules:**
  - Defaults: on; first show after 8 s; again every 10 s; "Until they subscribe".
  - Never shown on `/checkout`, `/order/*`, `/orders`, `/invoice/*`, in the admin, before `localStorage["bvsa-age-confirmed"] === "yes"`, or when switched off.
  - "No thanks", ✕ and Escape all close it, and it comes back on the interval.
  - "A set number of times" counts opens on the device, ever.
- **Device state:** `localStorage["bvsa-newsletter"] = { subscribed: boolean, shows: number, lastClosedAt: number | null }`. Every read and write is wrapped in try/catch.

## Review Focus

1. **A checkout preview that goes stale.** The visitor's preview shows 10% off, then another order with the same email uses it first. Expected: Place order doesn't charge more without saying so. Checkout shows the new total and asks again. Test: Task 2 e2e `changed total stops the order`.
2. **Two orders at the same moment with one email.** Expected: only one gets 10%. Test: Task 1 `a discount can be claimed once`.
3. **Delete and re-subscribe.** The team removes a subscriber who has used their 10%, and they sign up again. Expected: no second 10%. Test: Task 1 `used discounts outlive the subscriber row`.
4. **A pop-up during the 18+ check or the purchase.** Expected: it waits for the age check and never opens on the checkout, order, My orders or invoice pages. Test: Task 4 e2e `never during checkout`.
5. **Storage that throws, or a reload mid-countdown.** This covers private mode and a reload between closes. Expected: the store still works, and the countdown continues from the last close rather than restarting. Test: Task 4 `schedule continues after reload` (unit) and the try/catch rule above.

---

### Task 1: Data, discount rules and newsletter service

**Files:**
- Modify: `prisma/schema.prisma`, new migration `<ts>_newsletter_discount` (made with `prisma migrate diff`, then deploy and generate, as before)
- Create: `src/lib/discount.ts` (pure), `src/lib/discount.test.ts`, `src/lib/newsletter.ts` (server-only), `src/lib/newsletter.test.ts`

**Models:**
- `NewsletterSettings`: `id String @id @default("newsletter")`, `popupEnabled Boolean @default(true)`, `firstDelaySeconds Int @default(8)`, `repeatEverySeconds Int @default(10)`, `maxShows Int?` (null = until they subscribe), `updatedAt`.
- `DiscountRedemption`: `email String @id` (lowercased), `orderId String?` (Order, SetNull), `percent Int`, `createdAt`.
- `Order`: add `discountPercent Int @default(0)` and `discountCents Int @default(0)`.

**Interfaces:**
- `discount.ts`:
  - `NEWSLETTER_DISCOUNT_PERCENT = 10`
  - `discountCents(subtotalCents: number, percent: number): number`
  - `DISCOUNT_LABEL = (percent: number) => \`Newsletter discount (${percent}%)\``
- `newsletter.ts`:
  - `discountFor(email: string): Promise<number>` returns the percent, or 0.
  - `claimDiscount(tx: Prisma.TransactionClient, email: string, orderId: string, percent: number): Promise<boolean>` returns false on P2002, via a savepoint-free check: `createMany({ skipDuplicates: true })` count.
  - `subscribeEmail(email: string, source: "footer" | "popup" | "admin", visitorId: string | null): Promise<{ discount: "saved" | "used" }>`
  - `getNewsletterSettings(): Promise<NewsletterSettingsValues>` (`"use cache"`, `cacheTag("newsletter")`, `cacheLife("minutes")`, defaults when no row)
  - `saveNewsletterSettings(values: NewsletterSettingsValues): Promise<void>`
  - `type NewsletterSettingsValues = { popupEnabled: boolean; firstDelaySeconds: number; repeatEverySeconds: number; maxShows: number | null }`

- [ ] **Step 1: Write failing tests.**
  - `discount.test.ts`:
    - `discountCents(4700, 10) === 470`
    - `discountCents(4705, 10) === 471`
    - `discountCents(0, 10) === 0`
  - `newsletter.test.ts`, against the real DB with `test-` data cleaned up after:
    - `a subscriber's first order qualifies, a stranger's doesn't` (10 vs 0)
    - `a discount can be claimed once`: two concurrent `prisma.$transaction(tx => claimDiscount(tx, email, ...))` calls produce exactly one true
    - `used discounts outlive the subscriber row`: delete the subscriber, re-subscribe; `discountFor` is 0 and `subscribeEmail` returns "used"
    - `subscribeEmail says saved for a new email`
- [ ] **Step 2: Run** `npm test`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the schema and migration, then `discount.ts` and `newsletter.ts`. Also route `src/app/actions/newsletter.ts` `subscribe` through `subscribeEmail(email, "footer", visitorId)`.
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit`. Expected: pass.

### Task 2: Discount at checkout, on orders and invoices

**Files:**
- Modify:
  - `src/app/actions/checkout.ts`:
    - `quoteCart(lines, email?)` returns `Quote & { discount: { percent: number; cents: number } | null }`
    - `placeOrder` takes `expectedTotalCents`, and claims the discount in an interactive transaction with the order create
  - `src/components/checkout/checkout-form.tsx`: re-quote when the email is valid; a discount line; send `expectedTotalCents`; on `totalChanged` show the new total and the message
  - `src/lib/invoices/types.ts` and `src/lib/invoices/service.ts`: snapshot `discountPercent` and `discountCents` (optional, so old snapshots read as 0)
  - `src/components/invoice/invoice-document.tsx`: a discount line in both layouts
  - `src/app/(store)/order/[token]/page.tsx`: a discount line (from the snapshot or the order)
  - `src/lib/orders/edit.ts`: recompute `discountCents` from the order's `discountPercent`
  - `src/components/admin/orders/order-editor.tsx`: a discount line, and the total includes it
- Test: `src/lib/orders/edit.test.ts` (add one), `src/lib/invoices/service.test.ts` (add one), `$SCRATCHPAD/shot/e2e-newsletter.mjs` (checkout part)

**Interfaces:**
- Consumes: Task 1 `discountFor`, `claimDiscount`, `discountCents`, `DISCOUNT_LABEL`.
- `PlaceOrderResult` adds `{ ok: false; totalChanged: true; error: "Your total changed. Check the new total, then place your order again." }`.

- [ ] **Step 1: Write failing tests.**
  - `edit.test.ts`: `an order's newsletter discount follows its items`. The order has `discountPercent: 10`; after an edit to a subtotal of 13200, `discountCents === 1320` and the total = 13200 − 1320 + shipping.
  - `service.test.ts`: `snapshot carries the discount`.
  - `e2e-newsletter.mjs` (checkout part):
    - subscribe an email through the footer form
    - at checkout with that email, the summary shows "Newsletter discount (10%)" and the right total
    - place the order; the chat invoice shows the discount line and the same total
    - a second order with the same email shows no discount
    - `changed total stops the order`: two tabs preview with a fresh subscriber email; tab B orders first; tab A's Place order shows "Your total changed…" and the total without the discount, and a second click places it
- [ ] **Step 2: Run** `npm test` and the e2e (fresh build on port 3100). Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`, `e2e-newsletter.mjs` (checkout part), `e2e-checkout.mjs`, `e2e-invoices.mjs`. Expected: pass.

### Task 3: Admin > Settings > Newsletter pop-up

**Files:**
- Create: `src/lib/admin/schemas/newsletter.ts`, `src/app/admin/(panel)/settings/newsletter/page.tsx`, `src/components/admin/settings/newsletter-form.tsx`
- Modify:
  - `src/app/actions/admin/settings.ts`: `saveNewsletterSettings(input)` with `settings:write`; on success `refreshNewsletter()`
  - `src/lib/admin/revalidate.ts`: `refreshNewsletter()` expires "newsletter"
  - `src/components/admin/shell/nav.ts`: Settings gets "Newsletter pop-up" (MegaphoneIcon, `settings:write`)
  - `src/app/admin/(panel)/subscribers/page.tsx`: source "popup" reads "Signed up from the pop-up"

**Interfaces:**
- Schema input: `{ popupEnabled: boolean; firstDelaySeconds: number /* 0..600 */; repeatEverySeconds: number /* 5..86400 */; mode: "forever" | "times"; maxShows: number /* 1..100, used when mode is "times" */ }`.
- Form fields, labelled as in the mockup: "Show the pop-up"; "First show after (seconds)"; "If they close it, show it again every (seconds)"; "Keep showing it" with the choices "Until they subscribe" and "A set number of times"; "Stop after (times)". Button "Save"; toast "Pop-up settings saved".

- [ ] **Step 1: Extend the e2e:**
  - the owner saves 1 s / 3 s / "A set number of times" = 2
  - the page shows them after a reload
  - a staff account has no "Newsletter pop-up" nav item and is redirected away from the page
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the e2e (settings part). Expected: pass.

### Task 4: The pop-up

**Files:**
- Create:
  - `src/lib/newsletter-schedule.ts` (pure) and `src/lib/newsletter-schedule.test.ts`
  - `src/components/newsletter/popup-trigger.tsx` (client; timers, storage, exclusions; `next/dynamic` for the dialog)
  - `src/components/newsletter/newsletter-popup.tsx` (client; radix Dialog, centred at `sm+`, bottom sheet below)
- Modify:
  - `src/app/actions/newsletter.ts`: `subscribeFromPopup(input: { email: string }): Promise<{ ok: true; discount: "saved" | "used" } | { ok: false; error: string }>`, source "popup", analytics label "Newsletter pop-up"
  - `src/components/site/newsletter-form.tsx`: on success, mark the device subscribed
  - `src/app/(store)/layout.tsx`: mount the trigger in Suspense with `getNewsletterSettings()`

**Interfaces:**
- `nextShowDelay(state: { subscribed: boolean; shows: number; lastClosedAt: number | null }, settings: NewsletterSettingsValues, now: number, loadedAt: number): number | null`:
  - null when switched off, subscribed, or `maxShows` is reached
  - the first show waits `firstDelaySeconds` from page load
  - later shows wait until `lastClosedAt + repeatEverySeconds`, but never sooner than `firstDelaySeconds` after page load

- [ ] **Step 1: Write failing tests.**
  - `newsletter-schedule.test.ts`:
    - first show = 8000 ms
    - after a close at t, the delay is `t + 10000 − now`
    - `schedule continues after reload`: a load at t + 4000 gives 6000, not a restart
    - with `maxShows: 2` and `shows: 2` the result is null
    - "Until they subscribe" ignores `shows`
    - subscribed is null; off is null
    - a long-ago close waits only `firstDelaySeconds` from load
  - E2E:
    - With settings 1 s / 3 s / 2 times: a fresh visitor sees the pop-up about 1 s after the age check; "No thanks" closes it; it returns about 3 s later; after the second close it doesn't return within 8 s.
    - With "Until they subscribe" and 3 s: it returns after ✕, again after Escape, then subscribe shows the success text with the email, and after a reload it never shows.
    - The Visitors table marks that visitor as Subscriber.
    - `never during checkout`: with 1 s settings, a fresh visitor going straight to /checkout sees no pop-up for 6 s.
    - A used email subscribing in the pop-up gets the "already used" text.
    - At 390 px the pop-up is a bottom sheet and the page doesn't scroll sideways.
    - Restore the defaults at the end.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** The trigger keeps the dialog code out of the first load: it imports the dialog only when the delay elapses.
- [ ] **Step 4: Run** `npm test`, `e2e-newsletter.mjs` (all), `pages.mjs`, `e2e-analytics.mjs`. Expected: pass. Screenshot the pop-up on desktop and phone in both themes against the mockup.

### Task 5: Final checks

- [ ] **Step 1:**
  - run `npm test`, `npx tsc --noEmit`, `npx eslint .` and `npm run build`
  - run every e2e suite, with the admin products and taxonomy suites last, because their deliberate lockout tests block admin sign-ins for 15 minutes
  - record the module in `ADMIN-BLUEPRINT.md` Progress
- [ ] **Step 2:** After the final review's fix pass, delete the test data (the `@example.com` orders, subscribers, redemptions, visitors and test admins) and restore the newsletter settings to the defaults.
