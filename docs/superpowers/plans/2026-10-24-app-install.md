# Install the App, Notifications and the App Discount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The store installs as an app (with an install card, a pulsing navbar icon, a post-subscribe install pop-up and per-device steps), installing adds 10% to the welcome discount, installed devices can turn on chat and order notifications, and Admin › Visitors shows App and Notifications.

**Architecture:**
- **A PWA shell:** `src/app/manifest.ts`, static PNG icons in `public/icons/`, `public/sw.js` (offline page, push, notification click; no page caching), registered and the install event captured in `src/instrumentation-client.ts`.
- **One client install store** (`src/components/app/install-store.ts`) knows the platform, whether the browser can prompt, and whether this is the installed app; the card, the navbar icon, the pop-up and the steps dialog all read it. The offers are mounted once in the store layout (`AppOffers`), next to the newsletter `PopupTrigger`, and reuse its schedule (`nextShowDelay`).
- **The server owns the discount and the install record:** a device reports "running as the installed app" once; the server marks its `Visitor` (and the signed-in account's `Customer`). Checkout asks `welcomeDiscountFor(email, visitorId)`, which stacks newsletter 10 + app 10, still claimed once per email in the order transaction.
- **Push** with `web-push` and VAPID keys: subscriptions belong to the device (`deviceTokenHash`), so chat replies go to that chat's device and order updates to the device that placed the order.

**Tech Stack:** Next.js 16.4 (App Router, cacheComponents, `instrumentation-client.ts`, `manifest.ts`), React 19, Prisma 7 on Neon, zod 4, zustand, radix-ui, Tailwind v4, Phosphor icons, sharp (existing, for generating icons), **new: `web-push`**.

**Spec:** `docs/superpowers/specs/2026-10-24-app-install-design.md` (mockup: `.superpowers/brainstorm/651275-1792849789/content/install-the-app.html`)

## Global Constraints

- **Git:** no commits unless the owner asks; each task ends with a verification checkpoint and a ledger line.
- **Conventions:** server actions validate again; no em dashes; one accent; pill buttons; light and dark; Phosphor icons; `"use server"` files export only async functions.
- **Copy (spec/mockup):** card "Get the app, get 10% off" / "Faster ordering and order updates." / "Install" / ✕; pop-up eyebrow "YOU'RE SUBSCRIBED", title "Install the app and make it 20% off", ticks "20% off your next order (10% + 10%)", "Notifications when we reply or your order ships", "One tap from your home screen", buttons "Install the app" / "Not now"; discount lines "Newsletter discount (10%)", "App discount (10%)", "Newsletter + app discount (20%)"; app name "Best Vape Shop Australia", short name "Best Vape".
- **Never on** `/checkout`, `/order/*`, `/orders`, `/account`, `/invoice/*`, the admin, before the age check, inside the installed app, or when the admin switch is off. The card never uses `role="dialog"` (the newsletter trigger waits for open dialogs).
- **Service worker:** caches only `/offline.html`; never pages, prices or API responses.
- **Push:** permission only from a tap; every push shows a notification; 404/410 deletes the subscription; without VAPID keys everything push-related is hidden and the store works as now.
- **Discount:** percent = (subscriber ? 10 : 0) + (installed ? 10 : 0), 0 once the email has a `DiscountRedemption`; claimed once per email in the order transaction (unchanged).

## Review Focus

1. **An iPhone app with no cookies from Safari** (a new device). Expected: installing records on the app's own visitor; ordering in the app gets the app 10% (+10 if the email subscribed); nothing crashes when it isn't signed in. Test: Task 1 `installed by the device or by the account`.
2. **A subscriber who already used their 10% then installs.** Expected: no further discount. Test: Task 1 `a used welcome discount stays used`.
3. **The newsletter pop-up and the install offers at once.** Expected: never two pop-ups on screen; the card sits under a pop-up and never blocks it. Test: Task 4 e2e `the card never blocks the newsletter pop-up`.
4. **Push in a browser without support or with permission denied.** Expected: the button is hidden or explains it's blocked; nothing throws. Test: Task 5 e2e `notifications hidden without support`.
5. **A staff reply while the customer is on the site.** Expected: no push (they see the message icon); offline customers get one push per minute at most. Test: Task 5 `chat pushes skip online customers and wait a minute`.

---

### Task 1: Data, the welcome discount and the install record

**Files:**
- Modify: `prisma/schema.prisma` + migration: `Visitor.appInstalledAt DateTime?`, `Visitor.appPlatform String?`; `Customer.appInstalledAt DateTime?`; `Order.discountLabel String?`; `ChatConversation.lastPushAt DateTime?`; `NewsletterSettings.installOffersEnabled Boolean @default(true)`; `VisitorEventType` + `install_app`, `enable_notifications`; new `PushSubscription { id String @id @default(cuid()); endpoint String @unique; p256dh String; auth String; deviceTokenHash String; visitorId String?; platform String?; createdAt DateTime @default(now()); @@index([deviceTokenHash]); @@index([visitorId]) }`
- Modify: `src/lib/discount.ts` (`welcomeDiscount`, `discountLabel`), `src/lib/newsletter.ts` (`discountFor` → `welcomeDiscountFor`)
- Create: `src/lib/app-install.ts` (server-only), `src/lib/app-install.test.ts`
- Modify: `src/lib/discount.test.ts`, `src/lib/newsletter.test.ts`, `src/lib/analytics/labels.ts` (`install_app: "Installed the app"`, `enable_notifications: "Turned on notifications"`), `src/components/admin/analytics/parts.tsx` (icons `DeviceMobileIcon`, `BellRingingIcon`)

**Interfaces:**
- Produces:
  - `welcomeDiscount(input: { subscribed: boolean; installed: boolean; used: boolean }): { percent: number; label: string } | null` (pure, `src/lib/discount.ts`).
  - `discountLabel(newsletter: boolean, app: boolean): string`; `DISCOUNT_LABEL(percent)` stays for orders saved before labels (reads "Newsletter discount").
  - `welcomeDiscountFor(email: string, visitorId: string | null): Promise<{ percent: number; label: string } | null>` in `src/lib/newsletter.ts` (replaces `discountFor`).
  - `recordAppInstall(input: { visitorId: string | null; tokenHash: string | null; platform: string }): Promise<void>` and `isInstalled(input: { visitorId: string | null; email: string }): Promise<boolean>` in `src/lib/app-install.ts`. Recording sets `appInstalledAt` (first time only) and `appPlatform` on the visitor, and `appInstalledAt` on the customer of the device's conversation.
  - `markAccountInstalled(input: { visitorId: string | null; tokenHash: string }): Promise<void>`: when the device's visitor has installed, the customer of the device's conversation gets `appInstalledAt` (called after signing in or subscribing).
  - `appOffersFor(tokenHash: string | null): Promise<{ welcomeUsed: boolean; signedIn: boolean }>`: `welcomeUsed` when the device's account email has a `DiscountRedemption`.

- [ ] **Step 1: Write the failing tests:**
  - `discount.test.ts` `welcome discount stacks newsletter and app`: `{subscribed, !installed}` → `{10, "Newsletter discount (10%)"}`; `{!subscribed, installed}` → `{10, "App discount (10%)"}`; both → `{20, "Newsletter + app discount (20%)"}`; neither → null; `used: true` → null.
  - `app-install.test.ts`:
    - `installing marks the visitor and the signed-in account`: visitor `test-<stamp>-v`, device signed in via `openAccount(dev, email)`; `recordAppInstall({ visitorId, tokenHash: dev, platform: "iPhone" })` → visitor `appInstalledAt` set, `appPlatform "iPhone"`, the customer's `appInstalledAt` set; a second call keeps the first date.
    - `signing in on an installed device marks the account`: an installed visitor, then `openAccount(dev, email)` and `markAccountInstalled({ visitorId, tokenHash: dev })` → the customer's `appInstalledAt` set.
    - `offers know when the welcome discount is used`: a device signed into an email with a redemption → `{ welcomeUsed: true, signedIn: true }`; unknown device → `{ welcomeUsed: false, signedIn: false }`.
    - `installed by the device or by the account`: `isInstalled({ visitorId: installedVisitor, email: other })` true; `isInstalled({ visitorId: null, email })` true when that email's customer installed; false for a fresh visitor and email.
  - `newsletter.test.ts` `a used welcome discount stays used`: a subscriber whose visitor installed and who has a `DiscountRedemption` → `welcomeDiscountFor` null; without the redemption → 20.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL (missing exports).
- [ ] **Step 3: Implement** the schema (`prisma migrate diff … --script` into a new migration, `migrate deploy`, `generate`), then the functions. Update every `discountFor` caller to compile (checkout uses it in Task 2; until then pass `null` for the visitor).
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit`. Expected: pass.

### Task 2: Checkout, orders and invoices show the welcome discount

**Files:**
- Modify: `src/app/actions/checkout.ts` (quote and place order use `welcomeDiscountFor(email, visitorId from currentVisit())`; store `discountLabel`), `src/components/checkout/checkout-form.tsx`, `src/lib/invoices/{types,service}.ts` (snapshot `discountLabel?`), `src/components/invoice/invoice-document.tsx`, `src/app/(store)/order/[token]/page.tsx`, `src/components/admin/orders/order-editor.tsx` + `src/app/admin/(panel)/orders/[id]/page.tsx`
- Test: `src/lib/invoices/service.test.ts`

**Interfaces:**
- Consumes: `welcomeDiscountFor`, `discountLabel`, `DISCOUNT_LABEL`.
- Produces: `Quote.discount: { percent: number; cents: number; label: string } | null`; everywhere a discount line shows: `order.discountLabel ?? DISCOUNT_LABEL(order.discountPercent)`.

- [ ] **Step 1: Write the failing test** `snapshot carries the discount label`: an order with `discountPercent 20`, `discountLabel "Newsletter + app discount (20%)"` → `buildSnapshot` has that label.
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement.** The total-changed protection is unchanged (it compares totals, so a 10 → 20 change between quote and order is caught).
- [ ] **Step 4: Run** `npm test`, `tsc`. E2E (Task 4's suite): `an installed app's order gets 20% when subscribed`.

### Task 3: The installable app

**Files:**
- Create: `scripts/app/icons.mjs` (sharp: an SVG lime rounded square with a dark bold "B" → `public/icons/icon-192.png`, `icon-512.png`, `maskable-512.png` (B inside the centre 60%), and `src/app/apple-icon.png` 180), `src/app/manifest.ts`, `public/sw.js`, `public/offline.html`, `src/instrumentation-client.ts`, `src/lib/app-platform.ts` + `src/lib/app-platform.test.ts`, `src/components/app/install-store.ts`
- Modify: `src/app/layout.tsx` (`appleWebApp: { capable: true, title: "Best Vape", statusBarStyle: "black-translucent" }`), `next.config.ts` (headers for `/sw.js`: `Cache-Control: no-cache, no-store, must-revalidate`, `Service-Worker-Allowed: /`)

**Interfaces:**
- Produces:
  - `appPlatform(input: { userAgent: string; maxTouchPoints: number; standalone: boolean }): "iphone" | "ipad" | "android" | "mac-safari" | "chromium" | "firefox" | "in-app" | "other"` (pure).
  - `platformLabel(p): string` ("iPhone", "iPad", "Android", "Mac", "Windows"/"Desktop"…) for the admin.
  - `useInstall()` (zustand): `{ platform, canPrompt: boolean, isApp: boolean, prompt(): Promise<"accepted" | "dismissed" | "unavailable"> }`; `window` event `bvsa-install-ready` when `beforeinstallprompt` was captured (instrumentation-client stores it on `window.__bvsaInstallPrompt`).
  - Manifest: `name`, `short_name`, `description`, `start_url: "/?source=app"`, `scope: "/"`, `display: "standalone"`, `background_color`/`theme_color` `#0b0c0f`, icons 192/512 (`any`) and maskable 512.

- [ ] **Step 1: Write the failing tests** `app-platform.test.ts`: iPhone Safari UA → `iphone`; iPad with a Mac UA and `maxTouchPoints 5` → `ipad`; Mac Safari → `mac-safari`; Chrome desktop → `chromium`; Android Chrome → `android`; Firefox → `firefox`; Instagram/TikTok/Facebook in-app UAs → `in-app`.
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement** everything in the file list. The service worker: `install` caches `/offline.html` and `skipWaiting`; `activate` claims clients and deletes other caches; `fetch` only for navigations: network, falling back to the cached offline page; `push` shows `{ title, body, url }` (icon `/icons/icon-192.png`); `notificationclick` focuses an open tab or opens `url`. Register only in production builds and on `https`/localhost.
- [ ] **Step 4: Run** the unit test and an e2e `the store is installable`: `/manifest.webmanifest` has the names, `display: standalone` and the 192/512 icons (each 200 PNG); `/sw.js` is served with `no-cache`; after one reload `navigator.serviceWorker.controller` exists.

### Task 4: Install offers: card, navbar icon, pop-up, steps, recording, admin switch

**Files:**
- Create: `src/app/api/app/status/route.ts` (GET, `private, no-store`: `appOffersFor(current device)`), `src/components/app/app-offers.tsx` (controller, mounted in the store layout beside the newsletter trigger), `src/components/app/install-card.tsx`, `src/components/app/install-button.tsx` (navbar), `src/components/app/install-popup.tsx` (dynamic import), `src/components/app/install-guide.tsx` (dynamic import; steps per platform), `src/app/actions/app.ts` (`recordInstall`), `src/components/app/install-device.ts` (localStorage `bvsa-install`: `{ shows, lastClosedAt, recorded }`; sessionStorage `bvsa-install-card` for ✕)
- Modify: `src/app/actions/account.ts` and `src/app/actions/newsletter.ts` (after opening the account: `markAccountInstalled`), `src/app/(store)/layout.tsx`, `src/components/site/header.tsx` (install button before the account icon), `src/lib/newsletter.ts` + `src/lib/admin/schemas/newsletter.ts` + `src/app/actions/admin/settings.ts` + `src/components/admin/settings/newsletter-form.tsx` (`installOffersEnabled` switch "Show the app install card and pop-up")

**Interfaces:**
- Consumes: `useInstall`, `nextShowDelay`, `readDevice().subscribed` (newsletter device state), `NewsletterSettingsValues` (+ `installOffersEnabled`).
- Produces: `recordInstall(input: { platform: string }): Promise<{ ok: boolean }>` (server action: current visit + device token hash → `recordAppInstall`, event `install_app` with the platform label).
- Rules: card when offers on, not the app, not subscribed on this device, not dismissed this session, route allowed, age confirmed; pop-up when subscribed, not the app, on the newsletter schedule with its own counter, never while another dialog is open; navbar icon whenever offers on and not the app (also on hidden routes? no: same route rule); in the app, `recordInstall` once per device.

- [ ] **Step 1: Write the e2e** (`e2e-app.mjs`):
  - `the card shows on a first visit` (desktop and 390 px; text from the spec; not a dialog); `✕ hides it for the visit` (gone after reload in the same session, back in a new context).
  - `the navbar install icon pulses` (visible, has the pulse class) and `Install shows the right steps` (headless Chromium without a prompt → "browser menu" steps; iPhone UA → the three iPhone steps; Mac Safari UA → "Add to Dock").
  - `subscribing swaps the card for the install pop-up` (owner sets 1 s / 3 s; footer subscribe → card gone; pop-up with the spec copy within 5 s; Not now closes it; it returns).
  - `the card never blocks the newsletter pop-up` (fresh visitor, 1 s settings: the newsletter pop-up opens over the card and can be used).
  - `inside the app no offers, and the install is recorded` (init script makes `matchMedia('(display-mode: standalone)')` true: no card, icon or pop-up; Admin › Visitors shows the visitor with "App").
  - `an installed app's order gets 20% when subscribed` (standalone device, footer subscribe, checkout shows "Newsletter + app discount (20%)").
  - `switched off, no offers` (admin toggle off: no card, icon or pop-up; restore).
  - `never on checkout` (no card on /checkout).
  - `plain offers after the discount is used` (a device signed into an email with a redemption: the card reads "Get the app" without "10%").
  - `the app asks to sign in once` (standalone, not signed in: the "Sign in with your email to keep your app's 10%" card links to /account; signing in marks the account installed).
- [ ] **Step 2: Run** against a production build on 3100. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the e2e and `npm test`. Expected: pass. Screenshots of the card, icon, pop-up and steps (desktop/phone, dark/light) against the mockup.

### Task 5: Notifications

**Files:**
- Add dependency `web-push` (+ `@types/web-push`); generate VAPID keys into `.env.local` (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`; never printed)
- Create: `src/lib/push.ts` (server-only), `src/lib/push.test.ts`, `src/app/actions/push.ts`, `src/components/app/notifications-card.tsx`
- Modify: `src/lib/chat/service.ts` (after a staff message is saved: `notifyChat(conversationId)`), `src/lib/orders/edit.ts` (`changeOrderStatus` to paid/shipped/delivered: `notifyOrder(orderId, status)`), `src/app/(store)/account/page.tsx` (the card), `src/components/app/app-offers.tsx` (once after install, in the app)

**Interfaces:**
- Produces:
  - `pushConfigured: boolean`; `setPushSender(fn)` (tests replace the network call); `savePushSubscription(input: { endpoint; keys: { p256dh; auth }; tokenHash; visitorId; platform }): Promise<void>`; `pushToDevices(tokenHashes: string[], payload: { title; body; url }): Promise<number>` (deletes on 404/410, returns sent count); `notifyChat(conversationId: string): Promise<void>` (skips when the customer was seen in the last 60 s or `lastPushAt` is under 60 s old; title "Best Vape Shop", body the message preview, url `/account?chat=1`); `notifyOrder(orderId: string, status: "paid" | "shipped" | "delivered"): Promise<void>` (devices with `fullDetails` access; body e.g. "Order BV-10140 has shipped"; url the order page).
  - Actions: `enableNotifications(input: { endpoint: string; keys: { p256dh: string; auth: string }; platform: string }): Promise<{ ok: boolean; error?: string }>` (validates `https:` endpoint, key lengths; records `enable_notifications`), `disableNotifications(input: { endpoint: string })`.
  - `/account?chat=1` opens the chat.

- [ ] **Step 1: Write the failing tests** `push.test.ts` (sender replaced): `pushes go to the device's subscriptions and dead ones are removed` (two subscriptions, the sender returns 410 for one → it is deleted, count 1); `chat pushes skip online customers and wait a minute` (`customerLastSeenAt` now → no send; seen 5 min ago → send and `lastPushAt` set; a second call within 60 s → no send); `order pushes go only to the device that placed it` (one `fullDetails` device and one summary device → only the first).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** The card: hidden without `PushManager`/`Notification` or keys; on iPhone/iPad only inside the app; "Turn on notifications" asks permission from the tap, subscribes with the public key, calls `enableNotifications`; denied → "Notifications are blocked in your settings."
- [ ] **Step 4: Run** `npm test`; e2e `notifications hidden without support` (a context without Notification permission support shows no card) and `the account page offers notifications` (Chromium with keys: the card is visible).

### Task 6: Admin Visitors shows App and Notifications

**Files:**
- Modify: `src/lib/admin/queries/analytics.ts` (`visitorRowSelect` + `appInstalledAt`, `appPlatform`, `_count.pushSubscriptions`), `src/components/admin/analytics/visitor-table.tsx` (pills "App · iPhone" and "Notifications"), `src/app/admin/(panel)/analytics/visitors/[id]/page.tsx` (header pills; rows "App: Installed 24 Oct · iPhone", "Notifications: On" in "Where and on what"), `src/lib/admin/queries/visitors.ts` (`otherDevices` fields)
- Requires: `PushSubscription.visitor` relation to `Visitor` (onDelete SetNull) — add in Task 1's schema.

- [ ] **Step 1: Extend the e2e:** after the standalone install test, the visitor list row shows "App" and the visitor page shows the App row and the "Installed the app" event.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the e2e. Expected: pass.

### Task 7: Final checks

- [ ] `npm test`, `npx tsc --noEmit`, `npx eslint .`, `npm run build`, `e2e-app.mjs`, `e2e-account.mjs`; ADMIN-BLUEPRINT Progress (P20 device registry, adapted).
- [ ] After the final review's fix pass: delete test data (`@example.com` customers, subscribers, orders, chats, visitors, push subscriptions, test admins, login attempts); restore the settings.
- [ ] Tell the owner: set the two VAPID settings on the live host; check installing and notifications on a real iPhone once deployed.
