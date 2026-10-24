# Customer Account and Message Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subscribing (or typing an email under the new account icon) opens an account on that device with a chat to the team, and a message icon in the navbar counts the team's unread messages.

**Architecture:**
- **A device is signed in when it has a chat conversation.** `ChatConversation.deviceTokenHash` already ties one chat to one browser (the `bvsa_orders` cookie); signing in by email creates that conversation for the account's email without any order. Everything about a device stays keyed by its token hash, so a new device never reaches another device's messages or invoices.
- **One library function opens accounts** (`openAccount(tokenHash, email)`), used by the sign-in action and both newsletter actions; the cookie handling stays in the actions.
- **The chat button moves into the navbar.** `ChatLauncher` keeps the panel, presence and Pusher logic but publishes its status to the chat UI store instead of drawing the floating bubble; the header reads the store.

**Tech Stack:** Next.js 16.4 (App Router, cacheComponents), React 19, Prisma 7 on Neon, zod 4, zustand, Tailwind v4, radix-ui, Phosphor icons, Pusher (existing). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-24-customer-account-design.md` (mockup: `.superpowers/brainstorm/651275-1792849789/content/account-and-messages.html`)

## Global Constraints

- **Git:** the repo has git but the owner hasn't asked for commits; tasks end with a verification checkpoint and a ledger line, no commits.
- **Conventions:** server actions validate everything again; no em dashes; one accent (`--primary`); pill buttons; light and dark mode; Phosphor icons; `"use server"` files export only async functions.
- **No passwords, no email sending.** Email-only sign-in, rate-limited like "find my orders": 15 per IP, 10 per email, per 15 minutes.
- **Copy from the spec:**
  - Sign-in: title "Your account"; "Enter your email to open your account. New here? This creates one."; button "Continue"; small line "Subscribed already? Use the same email."
  - Account page: "Chat with us" card with an "Open chat" button; "Your orders"; "Sign out on this device".
  - Inbox tags: "Subscriber" (email is subscribed) or "New account"; empty preview "No messages yet".
- **Privacy rule (anti-goal):** a device signed in by email sees only its own new chat and order summaries (`fullDetails: false`); never earlier messages, invoices, street addresses, phones or order links from another device.
- **Simplicity (owner):** the plainest version of each piece.

## Review Focus

1. **Someone types a customer's email on their own phone.** Expected: a new empty chat, order summaries only; no invoice, address, phone or old messages. Test: Task 1 `a new device gets a fresh chat and only order summaries`; Task 6 e2e `another device sees summaries, not the first chat`.
2. **Subscribing with a second email on a signed-in device.** Expected: the device stays in its first account; the second email gets its own account. Test: Task 1 `a signed-in device stays in its account`.
3. **A device that ordered before this change.** Expected: it is already signed in (its chat exists), the account page shows its email and orders, and the message icon works. Test: Task 6 e2e `a customer who ordered is already signed in`.
4. **Signing out, then signing in again on the same device.** Expected: the old chat is unreachable from that browser; a new one starts. Test: Task 6 e2e `sign out forgets the device`.
5. **Many sign-ins in a row (someone trying a list of emails).** Expected: the 11th try for one email in 15 minutes is refused with a plain message. Test: Task 2 `sign-in is rate limited per email`.

---

### Task 1: Accounts on a device (schema + library)

**Files:**
- Modify: `prisma/schema.prisma` (`Customer.name String?`, `Customer.phone String?`) and a new migration
- Create: `src/lib/account.ts` (server-only), `src/lib/account.test.ts`
- Modify: `src/lib/chat/access.ts` (`customerActor` allows any device with a conversation; split out `actorForDevice`)

**Interfaces:**
- Produces:
  - `openAccount(tokenHash: string, email: string): Promise<{ conversationId: string; email: string; isNew: boolean }>`. Lowercases and trims the email. Creates the `Customer` (email only) if missing. If the device has no conversation: creates it (`customerId`, `customerEmail: email`, `customerName: customer.name ?? email`), adds every order with that email to the device as summaries (`OrderAccess` `fullDetails: false`, skip duplicates), announces the new chat to the inbox, and returns `isNew: true` with that email. If the device already has a conversation: changes nothing on the device and returns the conversation's existing email with `isNew: false`.
  - `accountForDevice(tokenHash: string): Promise<{ email: string; conversationId: string; lastMessagePreview: string; unread: number } | null>` (`unread` is the conversation's `customerUnreadCount`).
  - `actorForDevice(tokenHash: string): Promise<{ kind: "customer"; conversationId: string } | null>` in `src/lib/chat/access.ts`: the device's conversation, with no order required; `customerActor()` becomes `actorForDevice(await currentDeviceTokenHash())`.
  - `announceInbox(conversationId: string): Promise<void>` exported from `src/lib/chat/service.ts` (wraps the existing `announce(id, EVENTS.message, { inbox: true })`).

- [ ] **Step 1: Write the failing tests** in `src/lib/account.test.ts` (real DB; `test-<stamp>` token hashes and `test.account.<stamp>@example.com` emails; clean up in `after`):
  - `opening an account by email creates the customer and this device's chat`: `openAccount(dev, "  Mia.<stamp>@Example.com ")` → `isNew: true`, email lowercased; a `Customer` with that email, `name === null`, `phone === null`; the conversation for `dev` has `customerEmail === email` and `customerName === email`; `accountForDevice(dev)` returns that email and conversation id.
  - `an existing account opens without changing its details`: a `Customer` with name "Ann Test" and a phone; `openAccount` keeps both, and the new conversation's `customerName === "Ann Test"`.
  - `a signed-in device stays in its account`: `openAccount(dev, A)` then `openAccount(dev, B)` → second result `isNew: false`, `email === A`; a `Customer` for B exists; the conversation still says A; no `OrderAccess` for `dev` points at B's orders (create one order for B first).
  - `a new device gets a fresh chat and only order summaries`: an order with email A, `OrderAccess` for `dev1` with `fullDetails: true`, and `openOrderConversation(dev1, order)` (so `dev1`'s chat has the invoice); then `openAccount(dev2, A)` → a different conversation id, with 0 messages; `dev2`'s `OrderAccess` for that order has `fullDetails === false`.
  - `a device without orders can chat`: after `openAccount(dev3, C)`, `actorForDevice(dev3)` returns `{ kind: "customer", conversationId }` and `sendMessage` as that actor succeeds; `actorForDevice("test-<stamp>-nobody")` is null.
- [ ] **Step 2: Run** `node --conditions=react-server --import tsx --test src/lib/account.test.ts`. Expected: FAIL, cannot find module `./account`.
- [ ] **Step 3: Implement.** Schema change first: `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` into `prisma/migrations/<timestamp>_customer_optional_details/migration.sql`, then `npx prisma migrate deploy` and `npx prisma generate`. Then `src/lib/account.ts`, `actorForDevice`, `announceInbox`. The conversation create uses the existing unique `deviceTokenHash`; on a P2002 race, read the winner and treat it as already signed in.
- [ ] **Step 4: Run** the account tests, then `npm test`. Expected: all pass, including the existing chat tests (`email lookups never do` still holds: `ensureOrderChats` only opens chats for devices that placed the order).

### Task 2: Signing in, and subscribing opens the account

**Files:**
- Create: `src/app/actions/account.ts`
- Modify: `src/lib/customer-orders.ts` (export `deviceTokenHashForWrite(): Promise<string>`, the hash of the ensured cookie token), `src/lib/rate-limit.ts` (`accountLimiter = attemptLimiter("account", { ip: 15, email: 10 })`), `src/app/actions/newsletter.ts` (both `subscribe` and `subscribeFromPopup` call `openAccount` after `subscribeEmail`; an account failure is logged and never fails the subscription)
- Test: `src/lib/rate-limit.test.ts` (create if missing)

**Interfaces:**
- Consumes: `openAccount` (Task 1).
- Produces: `openMyAccount(input: { email: string }): Promise<{ ok: true; email: string } | { ok: false; error: string }>`. Errors: invalid email → "Enter a valid email, like name@example.com."; limited → "Too many tries. Wait 15 minutes, then try again."; failure → "Something went wrong. Please try again in a moment." Sign out reuses the existing `forgetOrders()` action.

- [ ] **Step 1: Write the failing test** `sign-in is rate limited per email`: with a unique `test.account.<stamp>@example.com` and IP `test-<stamp>`, `accountLimiter.isLimited` is false through 10 recorded tries and true after the 10th `record`; clean up the `LoginAttempt` rows (`key` starting `account:`) in `after`.
- [ ] **Step 2: Run** it. Expected: FAIL, `accountLimiter` is not exported.
- [ ] **Step 3: Implement** `accountLimiter`, `deviceTokenHashForWrite`, `openMyAccount`, and the newsletter changes.
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit`. Expected: pass.

### Task 3: The account page and the account icon

**Files:**
- Create: `src/app/(store)/account/page.tsx`, `src/components/account/sign-in-form.tsx` (client), `src/components/account/order-card.tsx` (the `OrderCard` moved out of the orders page, unchanged)
- Modify: `src/app/(store)/orders/page.tsx` (becomes `redirect("/account")`), `src/components/site/header.tsx` (the receipt icon becomes `UserCircleIcon` linking to `/account`, `aria-label="Your account"`; the mobile menu's "My orders" becomes "Your account"), `src/components/orders/forget-orders.tsx` (label "Sign out on this device"; after success `router.refresh()`), `src/components/newsletter/popup-trigger.tsx` (`/account` joins the hidden routes), `src/components/chat/chat-ui-store.ts` (adds `statusVersion: number` and `reloadStatus(): void`)

**Interfaces:**
- Consumes: `accountForDevice`, `currentDeviceTokenHash`, `ordersForThisDevice`, `openMyAccount`, `forgetOrders`, `OpenChatButton`.
- Produces: `useChatUi().reloadStatus()` (the launcher refetches `/api/chat/status` when `statusVersion` changes), called by the sign-in form and sign-out after success.

- [ ] **Step 1: Extend the e2e** (`e2e-account.mjs`, scratchpad) with: `the account icon opens sign-in` (a fresh device clicks "Your account" → `/account` shows "Your account" and the spec copy); `signing in opens the account` (Continue with a new email → the page shows the email, a "Chat with us" card and "Sign out on this device"); `/orders goes to the account page`.
- [ ] **Step 2: Run** it against a production build on port 3100. Expected: FAIL (no `/account`).
- [ ] **Step 3: Implement.** Signed out: the sign-in card (spec copy) in place of the account; signed in: email, the chat card (latest preview from the conversation, "N new" when `customerUnreadCount > 0`, "Open chat"), "Your orders" (the moved list; empty state "No orders yet" with a "Start shopping" link), "Sign out on this device". The page's personal parts render inside Suspense (cookies). `export const metadata = { title: "Your account", robots: { index: false, follow: false } }`.
- [ ] **Step 4: Run** the e2e. Expected: pass.

### Task 4: The message icon replaces the floating bubble

**Files:**
- Create: `src/components/chat/customer/messages-button.tsx` (client)
- Modify: `src/components/chat/chat-ui-store.ts` (adds `signedIn: boolean`, `unread: number`, `setStatus(s: { signedIn: boolean; unread: number }): void`), `src/components/chat/customer/chat-launcher.tsx` (publishes status to the store, draws no floating button; keeps the sheet, presence, Pusher and pending-open logic), `src/components/site/header.tsx` (the messages button before the account icon, desktop and phone), `src/app/api/chat/status/route.ts` (unchanged contract; now true for any signed-in device through `customerActor`)

**Interfaces:**
- Consumes: `useChatUi` status fields.
- Produces: `MessagesButton`: nothing for `signedIn === false`; otherwise a 40px round button with `ChatCircleDotsIcon`, `aria-label` "Messages" or "Messages, N unread", a lime count badge (99+ cap) when `unread > 0` and the panel is closed; clicking calls `setOpen(true)`.

- [ ] **Step 1: Extend the e2e:** `the message icon counts the team's messages` (a signed-in device; the owner sends "Hello from the team" in Admin › Chats; within 40 s the navbar's "Messages, 1 unread" button shows "1"; clicking opens the chat showing the message; after closing, no badge); `no floating chat bubble` (no fixed bottom-right "Chat with us" button on a signed-in device); `no message icon without an account` (fresh device).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** The badge refreshes on the launcher's existing schedule (every 30 s and when the tab comes back, instantly while the chat is open or for 10 minutes after they send, through Pusher), so the existing Pusher connection budget is unchanged.
- [ ] **Step 4: Run** the e2e and `npm test`. Expected: pass.

### Task 5: Admin inbox marks email-only accounts

**Files:**
- Modify: `src/lib/chat/types.ts` (`ConversationDTO.tag: "Subscriber" | "New account" | null`), `src/lib/chat/inbox.ts` (`listInbox` and `getConversation` fill `tag`), `src/components/admin/chat/inbox.tsx` (the tag as a small pill after the name; empty preview reads "No messages yet"), `src/components/admin/chat/context-panel.tsx` (under the name when `tag` is set: "Signed in by typing this email. This device hasn't placed an order, so it isn't proven to be them.")
- Test: `src/lib/chat/inbox.test.ts`

**Interfaces:**
- Produces: `tag` is null when the conversation has an order card (a `system` message with an `orderId`); otherwise "Subscriber" when a `Subscriber` row has the conversation's email, else "New account".

- [ ] **Step 1: Write the failing test** `a chat from a device without an order is tagged`: three conversations (one with an order card, one whose email is a subscriber, one plain) → tags `null`, `"Subscriber"`, `"New account"` from `listInbox({ q: "<stamp>" })`.
- [ ] **Step 2: Run** it. Expected: FAIL (`tag` undefined).
- [ ] **Step 3: Implement** with one batched `subscriber.findMany({ where: { email: { in: emails } } })` and a `_count` of order-card messages in the select.
- [ ] **Step 4: Run** `npm test`. Expected: pass. E2E: `admin sees the new subscriber tagged` (after a pop-up subscribe, Admin › Chats lists the email with "Subscriber" and "No messages yet"; the context panel shows the note).

### Task 6: End to end and final checks

- [ ] **Step 1: Finish `e2e-account.mjs`:**
  - `subscribing opens the account`: footer subscribe on a fresh device → message icon present, `/account` shows the email.
  - `another device sees summaries, not the first chat`: device 1 places an order with email E (its chat has the invoice); device 2 signs in with E → `/account` lists the order without an order link; opening the chat shows no invoice and no earlier messages.
  - `a signed-in device stays in its account`: signed in as F, subscribe G in the footer → `/account` still shows F.
  - `a customer who ordered is already signed in`: the device from the order test shows its email on `/account` and the message icon without signing in.
  - `sign out forgets the device`: "Sign out on this device" → sign-in card, no message icon; signing in again with the same email gives a chat with no earlier messages.
  - `on a phone the icons fit`: 390 px, signed in, the header shows search, messages, account and cart, and the page doesn't scroll sideways.
- [ ] **Step 2:** `npm test`, `npx tsc --noEmit`, `npx eslint .`, `npm run build`, `e2e-account.mjs`, and the newsletter e2e (recreated where needed). Screenshot the header (desktop/phone, light/dark), `/account` signed out and in, and the inbox tag against the mockup. Record the module in `ADMIN-BLUEPRINT.md` Progress.
- [ ] **Step 3:** After the final review's fix pass, delete the test data (`@example.com` customers, subscribers, orders, chats, visitors, test admins, login attempts).
