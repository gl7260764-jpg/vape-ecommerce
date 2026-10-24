# Order Invoices and Admin Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every order gets a designed invoice that opens the customer's chat with an "is everything correct?" question, and the admin gets an Orders area to fix any order and send the corrected invoice back into the chat.

**Architecture:**
- **Invoices are frozen snapshots.** An `Invoice` row stores everything the invoice shows as JSON (built from the order at send time). Only the status badge is computed live from the order status and whether a newer invoice exists.
- **The chat carries invoices as messages.** The existing chat service posts an invoice message (sender `system`, `invoiceId` set) and, while the order awaits payment, an automatic question message (sender `staff`, no staffId, `invoiceId` set) that the customer answers with a button. All money is computed on the server.
- **One invoice component, two layouts.** `InvoiceDocument` renders a snapshot as the full page (also printed / saved as PDF via the browser) or compact (inside a chat bubble).

**Tech Stack:** Next.js 16.4 (App Router, `cacheComponents`), React 19, Prisma 7 on Neon, zod 4, Tailwind v4, Phosphor icons, the existing chat (`src/lib/chat/*`, `src/components/chat/*`). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-23-order-invoices-design.md` (approved mockups: `.superpowers/brainstorm/1513814-1792744486/content/invoice-design.html`, `admin-order.html`)

## Global Constraints

- **No git:** tasks end with a verification checkpoint and a ledger line instead of a commit.
- **Admin conventions (`ADMIN-BLUEPRINT.md`):** `requireAdmin()` is the first statement of every admin action and route; pages call `requireAdminPage()`; actions return `ActionResult`. Order editing and sending need `orders:write`; business details need `settings:write`.
- **Simplicity (owner):** "make the system very simple and not complicated". The plainest version of each feature; nothing beyond the spec.
- **UI copy:** no em dashes; one accent (`--primary`, lime); pill buttons; `--radius-tile` cards; admin and chat work in light and dark mode. The invoice document itself is always paper-white with a black header and a lime rule, in both themes.
- **Money:** integer cents; the server recomputes every amount (line = unit × qty; subtotal = sum of lines; total = subtotal + shipping); GST shown = `Math.round(total / 11)`. en-AU formats, AUD.
- **Exact copy from the spec:**
  - Question: "Please check your invoice. Are your items, delivery address and contact details all correct?"
  - Buttons: "Yes, all correct" and "Something's wrong"
  - Customer's answers as their own messages: "Yes, all correct" / "Something's wrong with my invoice"
  - Automatic replies: "Thanks for confirming! We'll send your payment details here within 5 minutes." / "No problem. Tell us what needs changing and we'll send you an updated invoice."
  - Payment box note: "Payment details are sent in your chat"
  - Chat button under the invoice: "Open full invoice · Save as PDF"
  - Admin: "Not confirmed yet"; "Send invoice to chat" (or "Issue invoice" for orders with no chat); "Save changes"
  - Badges: "PAYMENT DUE", "PAID", "CANCELLED", "REPLACED"
- **Invoice numbers:** `INV-<order number>` for version 1, `INV-<order number>-<version>` after (INV-10053, INV-10053-2).
- **The question is asked only while the order status is `pending_payment`.**
- **Status labels (admin):** pending_payment "Awaiting payment", paid "Paid", processing "Packing", shipped "Shipped", delivered "Delivered", cancelled "Cancelled".

## Review Focus

1. **A stale invoice in an open chat.** The customer has the chat open when the admin sends INV-…-2 or marks the order paid. Expected: on the next sync the old invoice shows REPLACED with no buttons, and the badge shows PAID, without a reload (rows whose rendering changed must get a new `updatedAt`). Test: Task 2 `new invoice and status change reach a changedSince sync`.
2. **A double tap or a stale button.** The customer taps "Yes, all correct" twice, or taps a button on a replaced invoice from another tab. Expected: one answer and one reply; a replaced invoice's answer is refused. Test: Task 2 `answers once, and never on a replaced invoice`.
3. **The browser sending totals or prices it shouldn't.** Expected: the save action ignores any total from the client and recomputes; quantities 1 to 99 and unit prices 0 to $10,000 only; at least one item. Test: Task 4 `updateOrder recomputes totals and rejects bad lines`.
4. **Long names and addresses on a 390 px phone.** Expected: the invoice in the chat and the invoice page wrap without sideways scrolling. Test: Task 3 `invoice fits a phone`.
5. **Customers seeing unsent edits.** The admin saves but hasn't sent. Expected: the customer's order page and My orders still show the last sent invoice's items, address and total. Test: Task 4 e2e `saved edits stay private until sent`.

---

### Task 1: Data model, invoice rules and snapshots

**Files:**
- Modify: `prisma/schema.prisma`; new migration `prisma/migrations/<ts>_order_invoices/migration.sql` (made with `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, then `prisma migrate deploy`, `prisma generate`, as before)
- Create: `src/lib/invoices/types.ts` (client-safe), `src/lib/invoices/rules.ts` (pure, client-safe), `src/lib/invoices/rules.test.ts`, `src/lib/invoices/service.ts` (server-only), `src/lib/invoices/service.test.ts`, `src/lib/store-profile.ts` (server-only)

**Models:**
- `StoreProfile`: `id String @id @default("store")`, `email String?`, `phone String?`, `address String?` (multi-line), `abn String?`, `updatedAt`.
- `Invoice`: `id` (cuid), `orderId` (Order, Cascade), `version Int`, `number String @unique`, `snapshot Json`, `askConfirm Boolean`, `answer InvoiceAnswer?` (enum `confirmed`, `disputed`), `answeredAt DateTime?`, `sentById String?` (AdminUser, SetNull; null = automatic), `createdAt`; `@@unique([orderId, version])`.
- `OrderStatusChange`: `id`, `orderId` (Cascade), `from OrderStatus`, `to OrderStatus`, `adminId String?` (SetNull), `createdAt`; index on `orderId`.
- `ChatMessage`: add `invoiceId String?` (Invoice, SetNull) with an index.

**Interfaces:**
- Produces (`types.ts`):
  - `InvoiceSnapshot = { number: string; orderNumber: number; issuedAt: string; taxInvoice: boolean; business: { website: string; email: string | null; phone: string | null; address: string | null; abn: string | null }; billedTo: { name: string; email: string; phone: string }; shipTo: { name: string; addressLine1: string; addressLine2: string | null; suburb: string; state: string; postcode: string; shippingName: string }; items: { name: string; detail: string | null; imageKey: string | null; quantity: number; unitPriceCents: number; amountCents: number }[]; subtotalCents: number; shippingCents: number; gstCents: number; totalCents: number; paymentMethod: "bank_transfer" | "payid" }`
  - `InvoiceStatus = "payment_due" | "paid" | "cancelled" | "replaced"`
- Produces (`rules.ts`): `invoiceNumber(orderNumber: number, version: number): string`; `gstCents(totalCents: number): number`; `invoiceStatus(orderStatus: string, latest: boolean): InvoiceStatus`; `INVOICE_COPY` (the exact strings from Global Constraints); `ORDER_STATUS_LABEL: Record<OrderStatus, string>`.
- Produces (`service.ts`): `buildSnapshot(orderId: string, version: number): Promise<InvoiceSnapshot>`; `createInvoice(orderId: string, opts: { sentById: string | null }): Promise<{ id: string; number: string; version: number; askConfirm: boolean }>` (next version, `askConfirm = order.status === "pending_payment"`; P2002 on a racing version retries once); `latestInvoice(orderId: string)`.
- Produces (`store-profile.ts`): `getStoreProfile(): Promise<{ email; phone; address; abn }>` (nulls when unset); `saveStoreProfile(input)`.
- Item `detail` = the product's brand name and "<n> puffs", joined with " · ", or null. `business.website` = "bestvapeshopaustralia.com.au". `taxInvoice` = an ABN is set.

- [ ] **Step 1: Write failing tests.** `rules.test.ts`: `invoiceNumber(10053, 1) === "INV-10053"`, `invoiceNumber(10053, 3) === "INV-10053-3"`; `gstCents(17700) === 1609`; `invoiceStatus("pending_payment", true) === "payment_due"`, `("paid", true) === "paid"`, `("shipped", true) === "paid"`, `("cancelled", true) === "cancelled"`, `("paid", false) === "replaced"`. `service.test.ts` (real DB, `test-` prefixed data, cleaned up): `snapshot copies the order, items and business details` (totals, address, items with amounts, GST 1/11; with an ABN saved `taxInvoice` is true); `createInvoice numbers versions and asks only while awaiting payment` (v1 INV-n with askConfirm true; after the order is set to paid, v2 INV-n-2 with askConfirm false).
- [ ] **Step 2: Run** `npm test`. Expected: the new tests FAIL (modules missing); existing tests pass.
- [ ] **Step 3: Implement** the models and migration, then `types.ts`, `rules.ts`, `service.ts`, `store-profile.ts`.
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit`, `npx eslint src/lib`. Expected: all pass.

### Task 2: Invoices in the chat

**Files:**
- Modify: `src/lib/chat/service.ts`, `src/lib/chat/types.ts`, `src/lib/chat/service.test.ts`, `src/app/actions/chat.ts`
- Test: `src/lib/chat/invoice-chat.test.ts`

**Interfaces:**
- Consumes: Task 1 `createInvoice`, `buildSnapshot`, `invoiceStatus`, `INVOICE_COPY`.
- Produces:
  - `ChatMessageDTO.invoice: { id: string; number: string; version: number; snapshot: InvoiceSnapshot; status: InvoiceStatus; askConfirm: boolean; answer: "confirmed" | "disputed" | null; latest: boolean; link: string } | null` on both the invoice message and the question message. `link` is `/invoice/<publicToken>?v=<version>` for customers and `/admin/invoice/<orderId>/<version>` for staff.
  - `openOrderConversation` (same signature) now posts invoice v1 instead of the order card and welcome: in one transaction create the `Invoice` (version 1, `sentById` null), the invoice message (sender `system`, `orderId` and `invoiceId` set, id `orderMessageId(order, "card")`), and when `askConfirm` the question message (sender `staff`, staffId null, body = question, `invoiceId` set, id `orderMessageId(order, "welcome")`). Keeps idempotency, `staffUnreadCount +1`, preview "New order BV-<n>", and `customerUnreadCount +1`.
  - `postInvoice(invoiceId: string, opts: { byAdminId: string }): Promise<{ posted: boolean }>`: finds the order's conversation (via `OrderAccess` with `fullDetails` → `ChatConversation.deviceTokenHash`); without one returns `{ posted: false }`. Otherwise posts the invoice message and, if `askConfirm`, the question; `customerUnreadCount +1`; preview "Invoice <number>"; bumps `updatedAt` on the order's older invoice messages; announces.
  - `answerInvoice(actor: customer Actor, input: { invoiceId: string; answer: "confirmed" | "disputed" }): Promise<ChatMessageDTO[]>`: allowed only if the invoice's question is in the actor's conversation, it is the order's latest version, `askConfirm` is true and it is unanswered (`updateMany where answer null`, so a double tap answers once). Adds the customer's answer message and the automatic reply, bumps the invoice and question messages, `staffUnreadCount +1`, preview "Invoice confirmed" or "Invoice: something's wrong". Returns the new messages. Errors: `FORBIDDEN` (not theirs, replaced, not asking), `NOT_FOUND`.
  - `refreshInvoiceMessages(orderId: string): Promise<void>`: bumps `updatedAt` on the order's invoice and question messages and announces (used after a status change).
  - Customer action `answerInvoice(input)` in `src/app/actions/chat.ts`, same `asCustomer` wrapper.
- `ensureOrderChats` keeps working through `openOrderConversation`; past `pending_payment` it posts the invoice without the question.

- [ ] **Step 1: Write failing tests** in `invoice-chat.test.ts`: `a new order opens the chat with invoice v1 and the question` (DTO order: system message with `invoice.number === "INV-<n>"`, then the question with `invoice.askConfirm`; no welcome text); `answers once, and never on a replaced invoice` (two concurrent confirms give one answer and one reply; after a v2 is posted, answering v1 throws FORBIDDEN); `confirming adds the reply and alerts the team` (exact reply copy; staffUnreadCount up by 1; preview "Invoice confirmed"); `a paid order's new invoice has no question`; `new invoice and status change reach a changedSince sync` (after `postInvoice` of v2, a `listMessages(..., { changedSince })` from before it returns the v1 message with `invoice.status === "replaced"`; after the order is set to paid and `refreshInvoiceMessages`, the v2 message comes back with `status === "paid"`). Update the existing service test "order opens one conversation…" to expect the invoice and question instead of the card and welcome (ruling: copy changed by the spec).
- [ ] **Step 2: Run** `npm test`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the DTO field (select the invoice with its order's status, publicToken and latest version), `openOrderConversation`, `postInvoice`, `answerInvoice`, `refreshInvoiceMessages`, and the action.
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit`. Expected: all pass.

### Task 3: The invoice document, invoice pages and the customer's chat

**Files:**
- Create: `src/components/invoice/invoice-document.tsx` (no hooks; renders a snapshot + status in `layout: "page" | "compact"`), `src/components/invoice/print-button.tsx`, `src/app/invoice/[token]/page.tsx` (customer, outside the store chrome), `src/app/admin/invoice/[orderId]/[version]/page.tsx` (admin, outside the panel chrome; `requireAdminPage()`)
- Modify: `src/components/chat/message-bubble.tsx` (invoice message and question with buttons), `src/components/chat/use-chat.ts` (`answerInvoice(invoiceId, answer)`; `ChatActions.answerInvoice?`), `src/components/chat/customer/chat-panel.tsx` (focus the composer after "Something's wrong"), `src/components/chat/composer.tsx` (a `focusKey` prop), `src/app/(store)/order/[token]/page.tsx` and `src/lib/customer-orders.ts` (show the latest sent invoice's items, address, contact and totals when one exists; "View invoice" link), `src/app/(store)/orders/page.tsx` ("View invoice")
- Test: `$SCRATCHPAD/shot/e2e-invoices.mjs` (customer half); update copy expectations in `e2e-chat-api.mjs`, `e2e-chat-customer.mjs`, `e2e-chat-admin.mjs`

**Interfaces:**
- Consumes: Task 2 DTO `invoice` and the `answerInvoice` action; Task 1 types and rules.
- Layout follows the approved mockup (`invoice-design.html`): page layout = full reference layout; compact = the phone layout with "Open full invoice · Save as PDF" linking to `invoice.link`. A replaced invoice gets a diagonal "REPLACED" stamp and no buttons. The question bubble shows the two buttons only for customer viewers when `latest && askConfirm && !answer`; once answered it shows the answer; staff viewers see "Not confirmed yet" or the answer.
- `/invoice/[token]?v=<n>`: the order's invoice version n (latest when absent); 404 for an unknown token or version. A print button (`window.print()`) hidden in print; print CSS shows only the document.

- [ ] **Step 1: Write the failing e2e** `e2e-invoices.mjs` (customer half): place an order → the chat shows the invoice with `INV-<n>`, the item names, the street address, the total and "Bank transfer", then the question with both buttons; "Open full invoice" opens `/invoice/<token>` showing the same; `invoice fits a phone` (390 px, the chat invoice and the invoice page have no sideways scroll); print media hides the print button; tap "Something's wrong" → the customer's message "Something's wrong with my invoice", the automatic reply, the buttons gone, the composer focused. Update the three chat suites' welcome-text waits to the question text.
- [ ] **Step 2: Run** it against a fresh production build on port 3100. Expected: FAIL.
- [ ] **Step 3: Implement** the component, pages, chat rendering and the customer pages.
- [ ] **Step 4: Run** `e2e-invoices.mjs` (customer half), `e2e-chat-customer.mjs`, `e2e-chat-api.mjs`, `e2e-checkout.mjs`, `e2e-accounts.mjs`. Expected: all pass. Screenshot the invoice in light and dark chat themes and at 390 px, and check it against the mockup.

### Task 4: Admin Orders

**Files:**
- Create: `src/lib/orders/edit.ts` (server-only), `src/lib/orders/edit.test.ts`, `src/lib/admin/queries/orders.ts`, `src/lib/admin/schemas/order.ts`, `src/app/actions/admin/orders.ts`, `src/app/admin/(panel)/orders/page.tsx`, `src/app/admin/(panel)/orders/[id]/page.tsx`, `src/components/admin/orders/order-editor.tsx`, `src/components/admin/orders/invoice-timeline.tsx`
- Modify: `src/components/admin/shell/nav.ts` (Sales: Orders above Chats), `src/components/admin/chat/thread.tsx` (header pill from the latest question message in the thread: "Not confirmed yet" / "Invoice confirmed" / "Something's wrong"), `src/components/admin/chat/context-panel.tsx` (each order links to `/admin/orders/<id>`)
- Test: `e2e-invoices.mjs` (admin half)

**Interfaces:**
- Consumes: Task 1 `createInvoice`, `ORDER_STATUS_LABEL`; Task 2 `postInvoice`, `refreshInvoiceMessages`.
- Produces (`edit.ts`):
  - `updateOrder(orderId: string, input: OrderEditInput): Promise<{ ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> }>`. `OrderEditInput = { details: { fullName; email; phone; addressLine1; addressLine2; suburb; state; postcode }; shippingCode: string; paymentMethod: "bank_transfer" | "payid"; items: { id?: string; productId?: string | null; name: string; quantity: number; unitPriceCents: number }[] }`. Details are validated with the checkout rules (`validateCheckout`, so the messages match checkout); items: 1 to 50 lines, quantity 1 to 99, unit price 0 to 1,000,000 cents, names 1 to 200 characters; a new line's name, slug and image come from its product. Shipping: an unchanged code keeps the order's stored name and price; a changed code takes the current `ShippingMethod`. Replaces the items and recomputes subtotal and total in one transaction.
  - `changeOrderStatus(orderId: string, to: OrderStatus, adminId: string): Promise<void>` records an `OrderStatusChange`, then `refreshInvoiceMessages(orderId)`.
- Produces (actions, `orders:write`): `saveOrder(id, input)`, `setOrderStatus(id, status)`, `sendOrderInvoice(id): ActionResult<{ number: string; posted: boolean }>` (`createInvoice` with `sentById`, then `postInvoice`).
- Produces (queries): `listAdminOrders({ q, status, page })` (50 per page, newest first, counts per status; `q` matches the order number with or without "BV-", the name or the email); `getAdminOrder(id)` (order, items, invoices with answers, status changes with admin names, whether a chat exists, whether saved changes are newer than the latest invoice); `searchOrderProducts(q)` (active, purchasable products: id, name, priceCents, image; up to 20).
- Page layout follows `admin-order.html`: items editor with "+ Add product" search, customer and delivery fields, shipping and payment selects; right column with status select, the confirmation state ("Not confirmed yet" while the latest invoice asks and is unanswered), the invoice timeline (sent automatically or by whom, answers, status changes) with View / Print links; buttons "Open chat", "Save changes", "Send invoice to chat" ("Issue invoice" when there's no chat; Send saves unsaved edits first). A warning when the order is paid or later: changing items changes the total, and any difference is settled in the chat by hand. A note when saved changes haven't been sent.

- [ ] **Step 1: Write failing tests.** `edit.test.ts`: `updateOrder recomputes totals and rejects bad lines` (client-sent totals ignored; quantity 0 and 100, a negative price and zero lines are refused with field errors; a valid edit gives the right subtotal and total); `changing shipping takes the current price, keeping it keeps the old one`; `changeOrderStatus records who and when`. E2E admin half: an owner signs in → Orders lists the order with "Awaiting payment" and finds it by "BV-<n>" → the order page shows "Not confirmed yet" and the customer's "Something's wrong" → change the address and a quantity, see the total update, Save → `saved edits stay private until sent` (the customer's order page still shows the old address and total) → Send invoice to chat → the customer's chat shows `INV-<n>-2`, the old invoice REPLACED with no buttons → the customer taps "Yes, all correct" → the reply shows, and the order page timeline shows the confirmation → mark Paid → the chat invoice badge shows PAID → edit and send again → the new invoice has no question → a staff account can edit orders → the thread header shows the confirmation state.
- [ ] **Step 2: Run** `npm test` and the e2e. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`, `e2e-invoices.mjs`, `e2e-chat-admin.mjs`, `e2e-admin-products.mjs`. Expected: all pass. Screenshot the Orders list and the order page in both themes and at 390 px.

### Task 5: Business details and the final checks

**Files:**
- Create: `src/app/admin/(panel)/settings/business/page.tsx`, `src/components/admin/settings/business-form.tsx`, `src/lib/admin/schemas/business.ts`
- Modify: `src/app/actions/admin/settings.ts` (`saveBusinessDetails`), `src/components/admin/shell/nav.ts` (Settings: "Business details", `settings:write`), `src/app/(store)/order/[token]/page.tsx` ("What happens next" gets "Check your invoice" as the first step), `ADMIN-BLUEPRINT.md` (Progress)

**Interfaces:**
- Consumes: Task 1 `saveStoreProfile`, `getStoreProfile`.
- Business details: email (optional, valid email), phone (optional, Australian number via `normaliseAuPhone`), address (optional, up to 300 characters, multi-line), ABN (optional, 11 digits, spaces allowed, stored without spaces, shown as "12 345 678 901").

- [ ] **Step 1: Extend the e2e:** the owner saves an email, phone, address and ABN → the next invoice sent reads "TAX INVOICE" with the ABN and the details; already-sent invoices are unchanged; a staff account doesn't see Business details and its save is refused.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Final checks:** `npm test`, `npx tsc --noEmit`, `npx eslint .`, `npm run build`, then every e2e suite (pages, checkout, accounts, analytics, admin products, admin taxonomy, chat-api, chat-customer, chat-admin, invoices). Then delete the test data the suites created, as after the chat build.
