# Admin Push Notifications for Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin › Push notifications: press Push on a product, edit the prefilled title and message, and every device with notifications on gets it with the product photo; tapping opens the product.

**Architecture:** A `PushBroadcast` row records each send. `broadcastProduct` builds the payload from the product (title, message, `/product/<slug>`, main image) and sends it to every `PushSubscription` through the existing `pushToDevices` machinery (a new `pushToAll`), pruning dead ones; the service worker passes `image` through.

**Tech Stack:** Next.js 16.4, Prisma 7, zod 4, web-push (existing), radix-ui Dialog, Tailwind v4, Phosphor icons.

**Spec:** `docs/superpowers/specs/2026-10-25-push-broadcast-design.md`

## Global Constraints

- Owner only (`settings:write`); server actions validate again; no em dashes; pill buttons; light and dark.
- Copy: prefilled title "Just in: <product name>"; message "<price>. Tap to see it."; button "Send to N devices"; opt-in wording "Get told when we reply, your order ships, or new products land."
- Title 1–60 characters, message 1–160.
- No commits unless the owner asks; ledger per task.

## Review Focus

1. **A double click on Send.** Expected: one push. Test: Task 2 e2e `send can't be pressed twice`.
2. **A product with no photo.** Expected: the push goes without an image. Test: Task 1 `a product without a photo still sends`.
3. **Staff opening the page or calling the action.** Expected: refused. Test: Task 2 e2e `staff can't push`.
4. **Hundreds of devices.** Expected: sends in batches without timing out; dead ones pruned. Test: Task 1 `everyone gets it and dead ones go`.
5. **No VAPID keys (dev).** Expected: the page says notifications aren't set up and Send is disabled. Covered in Task 2 (`pushConfigured` passed to the page).

---

### Task 1: Data and sending

**Files:** `prisma/schema.prisma` + migration (`PushBroadcast { id, productId String?, product Product? (onDelete SetNull), title, body, url, image String?, sentById String?, sentBy AdminUser? (SetNull), sentCount Int, createdAt; @@index([createdAt]) }`); `src/lib/push.ts` (`pushToAll(payload): Promise<number>`, batches of 100); `src/lib/push-broadcast.ts` (`broadcastProduct({ productId, title, body, sentById }): Promise<{ sent: number }>`, `pushPreview(product)` helpers); `public/sw.js` (passes `image`); tests in `src/lib/push-broadcast.test.ts`.

- [ ] Tests (fake sender): `everyone gets it and dead ones go` (3 subscriptions, one 410 → sent 2, the dead one deleted, a `PushBroadcast` row with `sentCount 2`, `url "/product/<slug>"`, `image "/media/<key>"`); `a product without a photo still sends` (no image in payload); `an unknown product is refused` (throws, no row).
- [ ] RED, implement, GREEN; `npm test`.

### Task 2: The admin page

**Files:** `src/app/admin/(panel)/push/page.tsx`, `src/components/admin/push/{product-push-list,push-dialog}.tsx`, `src/app/actions/admin/push.ts` (`sendProductPush(input: { productId: string; title: string; body: string }): Promise<ActionResult<{ sent: number }>>`), `src/lib/admin/queries/push.ts` (devices count, last sent, products with last pushed, history), nav item "Push notifications" (BellRingingIcon, `settings:write`) in Marketing; opt-in wording in `notifications-card.tsx`, `offer-cards.tsx` (NotifyCard), `install-popup.tsx` (tick).

- [ ] E2E `e2e/e2e-push.mjs`: `the page lists products and the device count`; `Push prefills the title and message` (and shows the preview with the photo); `sending records it in the history` (history row with the product and "delivered"); `send can't be pressed twice`; `staff can't push` (no nav item, redirected); `the opt-in says product news is included`.
- [ ] RED, implement, GREEN; `npm test`; screenshots.

### Task 3: Final checks

- [ ] `npm test`, `tsc`, `eslint .`, build, `e2e-push`, `e2e-app` (push part); ADMIN-BLUEPRINT; final review; fix pass; cleanup.
