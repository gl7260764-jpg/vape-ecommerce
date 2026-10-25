# Admin blueprint: Best Vape Shop Australia

Source of truth for the admin panel. Every admin module reads this first.

## 1. The codebase

| Area | What exists | Evidence |
|---|---|---|
| Framework | Next.js 16.4.2 App Router, React 19.3, RSC, `cacheComponents: true`, `partialPrefetching: true` | `package.json`, `next.config.ts` |
| Rendering | Store pages prerendered (`generateStaticParams`), data in `"use cache"` functions tagged `catalog` / `shipping` | `src/lib/catalog-queries.ts`, `src/lib/checkout-queries.ts` |
| Data | Neon Postgres, Prisma 7 (`prisma-client` generator to `src/generated/prisma`), adapter-pg on the pooled URL | `prisma/schema.prisma`, `src/lib/db.ts` |
| Migrations | Hand-generated: `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` into `prisma/migrations/<ts>_<name>/migration.sql`, then `prisma migrate deploy` | `prisma/migrations/` |
| Storage | Neon object storage bucket `assets` (private) via `files-sdk`; served by `/media/<key>` only when the key matches `PUBLIC_KEY` | `src/lib/storage.ts`, `src/app/media/[...key]/route.ts` |
| Auth | **None yet.** No users, sessions or roles. | n/a |
| Styling | Tailwind v4, shadcn (radix-nova preset), tokens in `globals.css` (`--primary` lime, `--surface`, `--surface-2`, `--tile`, `--radius-tile`), light + dark via next-themes | `src/app/globals.css`, `components.json` |
| Icons | Phosphor (`@phosphor-icons/react`, `/dist/ssr` in server components) | throughout `src/components` |
| Validation | zod 4 (`z.email`, `z.flattenError`) | `src/lib/checkout.ts` |
| Writes | Server actions in `src/app/actions/*.ts` returning a typed result union | `src/app/actions/checkout.ts`, `newsletter.ts` |
| Toasts | sonner, `<Toaster>` in the root layout | `src/app/layout.tsx` |
| Formatters | `formatPrice(dollars)`, `mediaUrl(key)` in `src/lib/catalog.ts`; `orderNumber`, `formatAuPhone`, `paymentLabel`, `AU_STATES` in `src/lib/checkout.ts` | |
| Email/SMS/push | None configured | n/a |
| Jobs/crons | None | n/a |

## 2. What the system is

1. **Product:** a premium storefront for an Australian vape retailer (disposables, e-liquids, pod kits, accessories, nicotine pouches), redesigned from the WooCommerce store at bestvapeshopaustralia.com.au. 1,545 products, 37 brands, 39 categories. Guest checkout only.
2. **Actors:** customers (no accounts, identified by the email on an order) and the store team who run the shop (to be added: owner + staff).
3. **Unit of value and how it is confirmed:** an **Order** (`Order`, `OrderItem`). Payment is by bank transfer or PayID. Nothing is captured online: the team sends payment details by email or live chat, the customer transfers, and **a human confirms the money arrived** by moving `Order.status` from `pending_payment` to `paid`. Confirmation is manual.
4. **Money:** AUD, stored as integer cents (`priceCents`, `regularPriceCents`, `subtotalCents`, `shippingCents`, `totalCents`). Prices include GST. No discounts or refunds modelled yet. Shipping is a flat fee per method (`ShippingMethod`, Express $50, Regular $20).
5. **Order lifecycle:** `pending_payment → paid → processing → shipped → delivered`, with `cancelled` reachable before shipping.
6. **Constraints:**
   - Adults 18+ (an age gate on the storefront) and a nicotine warning in the footer.
   - Customer PII (names, addresses, phones) lives on `Order`, so the admin must be behind authentication and PII must never be logged.
   - Under Australian Consumer Law, a "was" price must be genuine. The admin therefore never invents a compare-at price.
   - Australian vape regulation (TGA) restricts how nicotine vapes can be sold. Compliance is the store owner's responsibility; the admin does not encode it.

## 3. Entity map

| Archetype | This system |
|---|---|
| CORE ENTITY | `Product` (+ `ProductImage`, `ProductCategory`) |
| TAXONOMY | `Category` (kinds: type, brand, series, collection; self-parented tree) and `Brand` |
| TRANSACTION | `Order` + `OrderItem` |
| ACTOR | Customers (derived from orders, no table); store team (`AdminUser`, to add) |
| IDENTITY/VISITOR | `Visitor` (first-party cookie id), `VisitorSession` (30-minute visits) |
| EVENT STREAM | `VisitorEvent` (page views and shop actions) |
| CONTENT | none (footer links to Shipping, Returns, About, Contact are unbuilt) |
| CHANNEL | `Subscriber` (newsletter signups) |
| CONFIG | `ShippingMethod`; payment details are not stored yet |

## 4. Module set

| # | Module | Verdict | Name here | Why |
|---|---|---|---|---|
| 1 | Auth & role gate | APPLICABLE | Admin sign-in | Nothing exists; every module depends on it |
| 2 | Shell | APPLICABLE | Admin layout | |
| 3 | Design primitives | APPLICABLE | `src/components/admin/ui` | Built on the store's tokens and shadcn |
| 4 | API conventions | ADAPTED | Server-action contract | The codebase writes through server actions; one route handler for uploads |
| 5 | Loading/error states | APPLICABLE | | Neon computes suspend when idle; cold starts are the main failure |
| 6 | Dashboard | APPLICABLE | Overview | Later: orders awaiting payment are time-critical (5-minute promise) |
| 7 | Analytics | APPLICABLE (requested 2026-10-22) | Analytics | First-party tracking added: visitors, visits, page views, sources, geo |
| 8 | Core entity CRUD | APPLICABLE | Products | Requested first |
| 9 | Taxonomy | APPLICABLE | Categories, Brands | Requested first |
| 10 | Transaction list | APPLICABLE | Orders | |
| 11 | Transaction detail | APPLICABLE | Order | |
| 12 | Manual confirmation | APPLICABLE | Payment confirmation | Value is confirmed by a human (section 2.3) |
| 13 | Payment config | ADAPTED | Payment details | BSB/PayID details plus a message template staff copy to the customer |
| 14 | Actors | ADAPTED | Customers (from orders) + Team | No customer accounts |
| 15 | Discounts | SKIP | | Checkout has no code field; not requested |
| 16 | Event stream | ADAPTED | Visitor activity | Page views + cart/search/checkout/order/subscribe events, shown per visitor and as a recent feed |
| 17 | Visitor CRM | APPLICABLE (requested) | Visitors | Visitor table + per-visitor timeline; email stitched from subscribe/order. Display clustering deferred |
| 18 | CMS | SKIP (for now) | | No editorial yet; the unbuilt info pages are an open question |
| 19 | Broadcast + push | SKIP | | No PWA/push |
| 20 | Device registry | SKIP | | |
| 21 | Mailing list | ADAPTED | Subscribers | List, add, delete, filter-aware CSV export, linked visitor. No email provider yet, so no delivery status/unsubscribe link |
| 22 | Campaign composer | SKIP | | No email provider |
| 23 | Tracked links | SKIP | | |
| 24 | Referral partners | SKIP | | |
| 25 | Settings | ADAPTED | Settings > Shipping (first), later Payment details, Store details, Team | Requested: shipping prices editable by the owner |

## 5. Navigation

- **Overview:** Dashboard
- **Insights:** Analytics, Visitors
- **Catalog:** Products, Categories, Brands
- **Sales:** Orders, Customers (later)
- **Marketing:** Subscribers
- **Settings:** Shipping, Payment details (later), Team (later)

Admin lives at `/admin`; sign-in at `/admin/login`.

## 6. Role matrix

Roles live on `AdminUser.role` (enum `AdminRole { owner staff }`). Permissions are coarse strings checked with `can(role, permission)`.

| Module | owner | staff |
|---|---|---|
| Products, Categories, Brands | read / write / delete | read / write (no delete) |
| Orders, payment confirmation | read / write | read / write |
| Customers, Subscribers | read / add / export / delete | read / add |
| Analytics, Visitors | read | read |
| Settings (shipping, payments, team) | configure | none |

Permissions: `catalog:write`, `catalog:delete`, `orders:write`, `settings:write`, `team:write`, `people:manage` (export/delete personal data); owner holds `*`.

## 7. Conventions contract

- **Routes:**
  - Admin pages: `src/app/admin/(panel)/**/page.tsx`, with the guarded layout at `src/app/admin/(panel)/layout.tsx`.
  - Login: `src/app/admin/login/page.tsx`, outside `(panel)` so it is not guarded.
  - Admin route handlers: `src/app/admin/api/**/route.ts`.
- **Code locations:**
  - Admin server code: `src/lib/admin/` (auth, password, rate limit, result envelope, revalidation, queries, schemas).
  - Admin server actions: `src/app/actions/admin/<resource>.ts`.
  - Admin components: `src/components/admin/` (`shell/`, `ui/`, one folder per module).
- **Guards:**
  - `proxy.ts` bounces requests without a session cookie. Pages go to `/admin/login?next=...`; `/admin/api/*` gets a 401.
  - The `(panel)` layout calls `requireAdminPage()`.
  - **Every admin data loader and every admin server action calls `requireAdmin(permission?)` as its first statement.**
- **Envelope:** `ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> }` from `src/lib/admin/result.ts`. Database errors go through `toActionError(error)`:
  - P2002 (unique) names the field.
  - Connection or timeout errors ask the operator to save again.
  - Anything else is logged, and the operator sees a calm generic message.
- **Validation:** zod schemas in `src/lib/admin/schemas/<resource>.ts`, shared by the form (instant feedback) and the action (the real check). Money is entered in dollars and stored in cents.
- **Freshness:**
  - Every catalog write calls `refreshCatalog()` (`updateTag("catalog")`), which covers home, shop, category, brand and product pages, plus search.
  - Shipping writes call `refreshShipping()` (`updateTag("shipping")`).
  - Helpers live in `src/lib/admin/revalidate.ts`; nothing invalidates ad hoc.
- **Admin reads:** never cached. Data loaders call `await connection()` (via `requireAdmin`, which reads cookies) and run behind `<Suspense>`.
- **Toasts:** `toast.success` / `toast.error` from `sonner`.
- **Formatting:** reuse `formatPrice`, `mediaUrl`, `orderNumber`, `formatAuPhone`; dates via `Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney" })`.
- **Deletion policy:**
  - A product referenced by an order is archived, not deleted.
  - A category with products or sub-categories, or a brand with products, cannot be deleted; the error names the counts and suggests hiding or reassigning.
  - Bucket images are not deleted with their product; orphans can be pruned by a script later.
- **Analytics capture:**
  - The store tracker (`src/components/analytics/page-tracker.tsx`, `src/lib/analytics/client.ts`) beacons to `POST /api/t`, which answers 204 and writes in `after()`.
  - Visitor id: cookie and localStorage `bvsa_vid`. Visit id: `bvsa_sid`, renewed after 30 minutes idle.
  - Location comes from host geo headers (Vercel, Cloudflare), falling back to DB-IP Lite (`npm run geo:update`, CC BY 4.0; credit on the analytics page).
  - Admins get a `bvsa_staff` cookie at sign-in, which marks their store visits as internal.
  - Bots and team visits are hidden by default; `?all=1` includes them.
- **Media:**
  - The browser downsizes images (max 2000px, WebP) and posts them to `/admin/api/upload`.
  - The server re-checks type and size, re-encodes with sharp (EXIF stripped), content-hashes the key as `products/<name>-<hash>.webp`, and stores it in the `assets` bucket.
- **Deviations from the generic prompts (deliberate):**
  - **Active nav state:** uses `usePathname()` in a small client link, which is correct on first paint because of SSR. It is not computed from an `x-pathname` header, because App Router layouts persist across navigations and would go stale.
  - **Password hashing:** scrypt from `node:crypto` (N=2^15). Equivalent strength to bcrypt, and no native dependency.
  - **Uploads:** proxy only, after resizing in the browser. No presigned PUT, because the bucket's CORS setup is unknown and the files are small after resizing.
  - **Compare-at price:** never auto-derived, because a fake "was" price is misleading under Australian Consumer Law.

## 8. Priority

- **Phase 1 (requested now):** P1 auth, P2 shell, P3 primitives, P4 contract, P5 states, then P8 Products, P9 Categories + Brands, P24-lite Shipping settings.
- **Phase 2:** P6 dashboard, P10/P11/P12 Orders + payment confirmation, P29 new-order alerts (the confirmation page promises a reply within 5 minutes), P13 payment details.
- **Phase 3:** P14 customers + team management, P21 subscribers + export, P30 audit log, sales report.

## Open questions

- Who besides the owner needs a login (staff), and should staff be blocked from deleting? Current assumption: one owner account to start; the staff role exists but is unused.
- How should the team hear about new orders within 5 minutes: email (needs a provider such as Resend), SMS, or a browser alert in the admin?
- The footer links (Shipping, Returns, About Us, Services, News, Contact) point to pages that don't exist. Should they be static pages or editable content?

## Progress

- [x] P0 Discovery: blueprint written 2026-10-22.
- [x] P1 Auth: built 2026-10-22.
  - Files: `src/proxy.ts`; `src/lib/admin/{auth,password,rate-limit,constants}.ts`; `src/app/actions/admin/auth.ts`; `src/app/admin/login/page.tsx`; `scripts/admin/create-admin.mts`; migration `20261022155442_admin_auth`.
  - Notes: accounts are created by script only (no sign-up). Sessions are DB-backed with an httpOnly cookie on path `/admin`. Rate limit: 8 per IP and 5 per email per 15 minutes, failing open.
- [x] P2 Shell: built 2026-10-22.
  - Files: `src/components/admin/shell/{nav.ts,sidebar.tsx}`, `src/app/admin/(panel)/layout.tsx`.
  - Notes: the store chrome (cart, age gate, grain, Lenis) moved from the root layout into `(store)/layout.tsx`.
- [x] P3 Design primitives: built 2026-10-22.
  - Files: `src/components/admin/ui/*`.
  - Notes: KpiCard, BarList, Donut and TimeSeries are deferred to P6/P7.
- [x] P4 Server-action contract: built 2026-10-22.
  - Files: `src/lib/admin/{result,revalidate,slug,format}.ts`, `src/app/admin/api/upload/route.ts`.
  - Notes: adapter-pg reports P2002 as `constraint.index` (`Model_field_key`), which is handled.
- [x] P5 Loading/error states: built 2026-10-22.
  - Files: `src/app/admin/error.tsx`, `src/app/admin/(panel)/{error,not-found}.tsx`, `src/components/admin/ui/{error-state,skeletons}.tsx`.
- [x] P8 Products: built 2026-10-22.
  - Files: `src/app/admin/(panel)/products/**`, `src/components/admin/products/*`, `src/lib/admin/{queries,schemas}/product*.ts`, `src/app/actions/admin/products.ts`.
  - Notes: no auto compare-at price (Australian Consumer Law). Photos are re-encoded to WebP with auto "fill" detection.
- [x] P9 Categories + Brands: built 2026-10-22.
  - Files: `src/app/admin/(panel)/{categories,brands}/**`, `src/components/admin/taxonomy/*`, `src/lib/admin/{queries,schemas}/taxonomy.ts`, `src/app/actions/admin/taxonomy.ts`.
  - Notes: the brand editor covers name and web address only, because the storefront uses no other brand fields.
- [x] P24 Shipping settings: built 2026-10-22.
  - Files: `src/app/admin/(panel)/settings/shipping/page.tsx`, `src/components/admin/settings/shipping-form.tsx`, `src/app/actions/admin/settings.ts`.
  - Notes: owner only; at least one option must stay on.
- [x] P7 Analytics: built 2026-10-23.
  - Files: `src/app/admin/(panel)/analytics/page.tsx`, `src/lib/admin/queries/analytics.ts`, `src/components/admin/charts/{column-chart,bar-list}.tsx`, `src/components/admin/analytics/parts.tsx`.
  - Capture: `src/lib/analytics/*`, `src/app/api/t/route.ts`, `src/components/analytics/page-tracker.tsx`; migration `20261022185836_visitor_analytics`.
  - Notes:
    - Chart mark colour `--chart-mark` passes the dataviz validator in both modes.
    - Tracking tags are stripped from stored paths; order-confirmation tokens are never stored.
    - Hits are retried once on database connection errors, and each hit carries its visit's attribution so that parallel hits can't misattribute a visit.
- [x] P16 Visitor activity: built 2026-10-23 as the per-visitor timeline and the "recent shopper activity" feed.
  - Notes: no raw-event retention job yet.
- [x] P17 Visitors: built 2026-10-23.
  - Files: `src/app/admin/(panel)/analytics/visitors/{page,[id]/page}.tsx`, `src/lib/admin/queries/visitors.ts`, `src/components/admin/analytics/visitor-table.tsx`.
  - Notes: email stitched from orders and signups, and the same email on other devices is listed. Display clustering is deferred.
- [x] P21 Subscribers: built 2026-10-23.
  - Files: `src/app/admin/(panel)/subscribers/page.tsx`, `src/lib/admin/queries/subscribers.ts`, `src/app/actions/admin/subscribers.ts`, `src/app/admin/api/subscribers/export/route.ts`.
  - Notes: no email provider, so no delivery status or unsubscribe link yet.
- [ ] P6 Dashboard (a basic overview exists at `/admin`; full KPIs pending)
- [ ] P10 Orders list
- [ ] P11 Order detail
- [ ] P12 Payment confirmation
- [ ] P29 New-order alerts
- [ ] P13 Payment details
- [ ] P14 Customers + Team
- [ ] P21 Subscribers
- [ ] P30 Audit log
- [x] Customer chat (WhatsApp-style, not in the P-catalogue; closest to P10/P29): built 2026-10-23.
  - Files: `src/app/admin/(panel)/chats/{layout,page,[id]/page}.tsx`, `src/components/admin/chat/*`, `src/app/admin/api/chat/**`, `src/app/admin/api/pusher/auth/route.ts`, `src/app/actions/admin/chat.ts`.
  - Shared: `src/lib/chat/*` (rules, service, inbox, files, presence, realtime), `src/components/chat/*` (useChat, bubbles, composer, emoji picker), customer side in `src/components/chat/customer/*` and `src/app/api/chat/**`; migration `20261023041300_customer_chat`.
  - Notes:
    - One conversation per ordering device (the `bvsa_orders` cookie); devices that only found orders by email get no chat.
    - Pusher Channels for live updates (events are "something changed" nudges; content always comes from the access-checked sync), with polling when keys are missing or the connection drops.
    - Owner can delete any message; staff only their own. Photos and PDFs up to 4 MB, private bucket prefix `chat/<conversationId>/`.
    - Sidebar badge, chime, "(n)" tab title and opt-in desktop notifications come from `ChatWatcher` in the shell.
- [x] P10/P11 Orders (list + order page) and invoices: built 2026-10-23.
  - Files: `src/app/admin/(panel)/orders/{page,[id]/page}.tsx`, `src/components/admin/orders/*`, `src/lib/admin/queries/orders.ts`, `src/lib/admin/schemas/order.ts`, `src/lib/orders/edit.ts`, `src/app/actions/admin/orders.ts`; invoices in `src/lib/invoices/*`, `src/components/invoice/*`, `src/app/invoice/[token]/page.tsx`, `src/app/admin/invoice/[orderId]/[version]/page.tsx`; business details in `src/app/admin/(panel)/settings/business/page.tsx`; migration `20261023120213_order_invoices`.
  - Notes:
    - Every invoice is a frozen snapshot (INV-<n>, then INV-<n>-2…); only the badge (PAYMENT DUE / PAID / CANCELLED / REPLACED) is live.
    - The invoice opens the order's chat with "is everything correct?" while the order awaits payment; answers become chat messages and alert the team.
    - The admin can change everything on an order; customers see only what was last sent. Orders with no chat get "Issue invoice".
    - Business details (owner only) fill the invoice header; with an ABN the title is TAX INVOICE.
- [x] P21/P15 (adapted) Newsletter pop-up and subscriber discount: built 2026-10-23.
  - Files: `src/lib/{discount,newsletter,newsletter-schedule}.ts`, `src/components/newsletter/*`, `src/app/actions/newsletter.ts` (`subscribeFromPopup`), checkout in `src/app/actions/checkout.ts` and `src/components/checkout/checkout-form.tsx`; settings in `src/app/admin/(panel)/settings/newsletter/page.tsx`, `src/components/admin/settings/newsletter-form.tsx`, `src/lib/admin/schemas/newsletter.ts`; migration `20261023201347_newsletter_discount`.
  - Notes:
    - 10% off the items on a subscriber's next order, once per email, no code. `DiscountRedemption` (email primary key) is claimed in the same transaction as the order; if it was already used, the order isn't placed and checkout shows the new total.
    - The order keeps the discount as a percentage, so admin edits recompute it; it shows as "Newsletter discount (10%)" at checkout, on the invoice, the order page and the admin order page.
    - The pop-up (owner settings: on/off, first delay, interval, until they subscribe or a set number of times) never shows on checkout, order, My orders or invoice pages, before the age check, or over another dialog. Device state is `localStorage["bvsa-newsletter"]`.
    - Subscribers record their source (footer, pop-up, team); the Visitors page marks them.
- [x] Customer accounts and the message icon (adapts P14): built 2026-10-24.
  - Files: `src/lib/account.ts`, `src/app/actions/account.ts`, `src/app/(store)/account/page.tsx`, `src/components/account/*`, `src/components/chat/customer/messages-button.tsx`, `src/lib/chat/{access,inbox}.ts`, `src/components/admin/chat/{inbox,context-panel}.tsx`; migration `20261024135728_customer_optional_details`.
  - Notes:
    - An email opens an account on a device (no password, rate-limited 15/IP and 10/email per 15 minutes). Subscribing opens it too. A device is signed in when it has a chat (`ChatConversation.deviceTokenHash`).
    - A new device gets its own empty chat and order summaries only; messages, invoices and full order details stay on the device that made them.
    - The navbar's account icon goes to `/account` (`/orders` redirects there); the message icon shows the team's unread messages and replaced the floating chat bubble.
    - Admin › Chats tags chats from devices that haven't ordered ("Subscriber" / "New account") with a note that the email isn't proven.
- [x] P20 (adapted) Install the app, notifications and the app discount: built 2026-10-24.
  - Files: `src/app/manifest.ts`, `public/sw.js`, `public/offline.html`, `public/icons/*`, `src/app/apple-icon.png`, `scripts/app/icons.mjs`, `src/instrumentation-client.ts`, `src/components/app/*`, `src/lib/{app-install,app-platform,push,quiet-routes}.ts`, `src/app/actions/{app,push}.ts`, `src/app/api/app/status/route.ts`; admin tags in `src/components/admin/analytics/visitor-table.tsx` and the visitor page; migration `20261024164435_app_install_push`.
  - Notes:
    - Installing adds 10% to the welcome discount (newsletter 10% + app 10% = 20%, once per email), decided at checkout from the device (`Visitor.appInstalledAt`) or the email's account (`Customer.appInstalledAt`). The discount line names its parts and is stored on the order (`discountLabel`).
    - Offers: a bottom card before subscribing, a pulsing navbar icon, an install pop-up after subscribing on the newsletter timing, per-device steps where the browser can't prompt. One switch in Admin › Settings › Newsletter pop-up. No discount wording once the device's account has used it.
    - Notifications (web push, `web-push` + VAPID keys in env): team chat replies (not while the customer is online, at most one a minute) and order paid/shipped/delivered, to the device that owns the chat or placed the order. Dead subscriptions are deleted on 404/410.
    - Admin › Visitors: "App · <device>" and "Notifications" tags, App/Notifications rows on the visitor page, "Installed the app" / "Turned on notifications" events.
- [x] Live chat for every visitor and checkout auto-fill: built 2026-10-25.
  - Files: `src/lib/chat/start.ts`, `src/app/actions/chat.ts` (`startChatAction`), `src/components/chat/customer/{chat-launcher,chat-window,start-chat,notify-banner}.tsx`, `src/lib/checkout-details.ts`, `src/app/actions/checkout.ts` (`savedDetails`), `src/components/checkout/checkout-form.tsx`; e2e suites in `e2e/`.
  - Notes:
    - A floating chat button on every store page (pulses until first opened). With no account on the device, the window asks for an email and a first message: one action opens the account and sends it (3 starts per IP / 2 per email every 15 minutes, plus a trap field). Afterwards it opens straight to the conversation ("Chatting as <email>").
    - Computers: a floating window, page usable behind it. Phones: full screen and modal. The navbar message icon stays.
    - Checkout fills name, email, phone and address from the last order placed on this device ("Filled in from your last order · Clear"); a device that only typed an email gets just the email.
    - Browser suites live in `e2e/` (Playwright, system Chrome); admin steps need `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` for a test owner.
- [x] P19 (adapted) Push notifications for products: built 2026-10-25.
  - Files: `src/app/admin/(panel)/push/page.tsx`, `src/components/admin/push/product-push-list.tsx`, `src/app/actions/admin/push.ts`, `src/lib/admin/queries/push.ts`, `src/lib/push-broadcast.ts`, `src/lib/push.ts` (`pushToAll`), `public/sw.js` (image, renotify); migration `20261025050615_push_broadcast`; e2e `e2e/e2e-push.mjs`.
  - Notes:
    - Marketing › Push notifications (owner only): device count, last sent, a product search (active, purchasable products) with a Push button each. Push opens a box with an editable title ("Just in: <name>", up to 60) and message ("<price>. Tap to see it.", up to 160), a preview with the photo, and "Send to N devices".
    - Every device with notifications on gets it, 100 at a time; tapping opens the product. The photo shows on Android and Windows; Apple shows the store icon only. Dead subscriptions are deleted on 404/410.
    - Each send is kept (`PushBroadcast`): product, title, who sent it, how many the push services accepted, when. The opt-in wording everywhere now mentions new products.
