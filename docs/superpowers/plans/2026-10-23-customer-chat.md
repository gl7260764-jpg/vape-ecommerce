# Customer Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A WhatsApp-style chat between each ordering customer's device and the store team, with a shared admin inbox.

**Architecture:**
- **Source of truth:** Postgres (Prisma). Every write goes through a server action or route that calls one server-side chat service.
- **Live updates:** after each write the service publishes a small Pusher Channels event. Clients poll Route Handlers whenever Pusher is unavailable.
- **Who is who:** customers are identified by the httpOnly `bvsa_orders` device cookie; admins by the existing admin session.

**Tech Stack:**
- Next.js 16.4 (App Router, `cacheComponents`), React 19, Prisma 7, Neon Postgres, Neon object storage (`files-sdk`), sharp, zod 4, Tailwind v4, Phosphor icons, sonner
- New: `pusher` 5.3.4 (server), `pusher-js` 8.6.0 (browser), `frimousse` 0.4.0 (emoji picker)

**Spec:** `docs/superpowers/specs/2026-10-23-customer-chat-design.md`

## Global Constraints

- **No git.** The project is not a git repository, so tasks end with a verification checkpoint instead of a commit.
- **Admin conventions** from `ADMIN-BLUEPRINT.md`:
  - `requireAdmin()` is the first statement of every admin loader, action and route.
  - Admin pages call `requireAdminPage()` before loading data.
  - Actions return `ActionResult` from `src/lib/admin/result.ts`.
- **UI copy:** no em dashes. One accent colour (`--primary` / `--primary-ink`). Pill buttons. `--radius-tile` cards. Every component must work in light and dark mode.
- **Values copied from the spec:**
  - own messages can be edited and deleted at any time (no time limit); the owner can delete any message
  - message body up to 4,000 characters
  - photos and PDFs only, up to 4 MB (photos shrunk in the browser to at most 2000 px first, then re-encoded server-side to WebP without EXIF)
  - customers can send 30 messages a minute per conversation, staff 60
- **Timing values:**
  - heartbeat every 25 s
  - customer online within 45 s; team online within 60 s
  - typing pings at most every 3 s; "typing..." shown for 5 s
  - chat-open poll every 4 s; admin badge poll every 20 s; customer unread poll every 30 s
  - customers connect to Pusher only while the chat panel is open, and for 10 minutes after sending
  - the newest 200 messages are loaded first
- **Copy:**
  - Quick reactions: 👍 ❤️ 😂 😮 😢 🙏
  - Automatic order message: "Thanks! We'll send your payment details here within 5 minutes."
  - Deleted: "This message was deleted", or "You deleted this message" only for the person who deleted it.
  - Edited: "Edited".
- **Pusher names:**
  - Channels: `private-conversation-<id>`, `private-admin-inbox`, `store-status`.
  - Events: `message`, `reaction`, `receipts`, `client-typing`, `inbox`, `badge`, `presence`.
  - Auth endpoints: `/api/pusher/auth` (customers), `/admin/api/pusher/auth` (admins).
  - Environment: `PUSHER_APP_ID`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`. The app must work fully, by polling, when any of them is missing.
- **Files:**
  - Chat files live under the bucket prefix `chat/<conversationId>/`.
  - They are served only by the access-checked routes in Task 3 and Task 5, never by `/media`.
- **Devices:** devices that found orders by email (`OrderAccess.fullDetails = false`) get no chat access.

## Review Focus

1. **Message content and file names are untrusted.**
   - The input: a body like `<img src=x onerror=alert(1)>`, or a PDF named `"><script>.pdf`.
   - Expected: both render as text, files are served with `X-Content-Type-Options: nosniff`, and anything that isn't a photo or PDF (SVG, HTML, Word) is refused.
   - Tests: Task 1 (`only photos and pdfs`) and Task 4 (`xss body renders as text`).
2. **The same device has two tabs open.**
   - The input: one sent message arriving by both the optimistic path and the live/poll path in each tab.
   - Expected: it shows once, matched by the browser-made uuid.
   - Test: Task 4 (`two tabs show one bubble`).
3. **A send fails.**
   - The input: an offline network or a 500 error.
   - Expected: the bubble stays with a "Not sent. Tap to retry" state, and retrying does not duplicate it.
   - Test: Task 4 (`failed send can be retried once`).
4. **The admin tab is in the background.**
   - The input: a new message arrives while the tab is hidden.
   - Expected: it is marked delivered but not read; read only happens once the tab is visible.
   - Test: Task 5 (`hidden tab does not mark read`).
5. **Very long words, long URLs and emoji-only messages on a 390 px screen.**
   - Expected: no sideways scroll, and bubbles wrap.
   - Test: Task 4 (`long word wraps on mobile`).

---

### Task 1: Chat rules and the test runner

Pure, client-safe rules shared by server and UI, plus a test runner using Node's own test runner (no new dependency).

**Files:**
- Modify: `package.json`: add the script `"test": "node --conditions=react-server --import tsx --test \"src/**/*.test.ts\""`
- Create: `src/lib/chat/rules.ts`, `src/lib/chat/rules.test.ts`

**Interfaces:**
- **Produces from `rules.ts`:**
  - Constants: `MAX_BODY = 4000`, `MAX_UPLOAD_BYTES = 4 * 1024 * 1024`, `ONLINE_MS = { customer: 45_000, staff: 60_000 }`, `QUICK_REACTIONS = ["👍","❤️","😂","😮","😢","🙏"]`, `RATE_PER_MINUTE = { customer: 30, staff: 60 }`.
  - Types:
    - `type Actor = { kind: "customer"; conversationId: string } | { kind: "staff"; adminId: string; canModerate: boolean }`
    - `type MessageFacts = { sender: "customer" | "staff" | "system"; staffId: string | null; conversationId: string; createdAt: Date; deletedAt: Date | null; hasAttachment: boolean }`
  - `canEdit(m: MessageFacts, a: Actor): boolean`: the sender's own text messages that aren't deleted, at any time.
  - `canDelete(m: MessageFacts, a: Actor): boolean`: the sender's own messages at any time, and any non-system message for moderators.
  - `isOnline(lastSeenAt: Date | null, kind: "customer" | "staff", now: Date): boolean`
  - `attachmentKind(mime: string): "image" | "file" | null`. Allowlist:
    - images: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/heic`
    - files: `application/pdf` only
  - `previewText(m: { body: string; deletedAt: Date | null; attachmentKind: "image" | "file" | null; attachmentName: string | null }): string`. Returns "This message was deleted", "Photo", the file name, or the body cut to 80 characters.
- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/chat/rules.test.ts (node:test + node:assert/strict)
test("customer edits own text at any time", () => {
  const m = facts({ sender: "customer", createdAt: t0 });
  assert.equal(canEdit(m, customer), true);
  assert.equal(canEdit({ ...m, createdAt: plus(t0, -365 * 86_400_000) }, customer), true); // a year later still fine
  assert.equal(canEdit({ ...m, hasAttachment: true }, customer), false); // photos and PDFs can't be edited
  assert.equal(canEdit({ ...m, deletedAt: t0 }, customer), false);
});
test("staff edits only messages they sent", () => {
  const m = facts({ sender: "staff", staffId: "a1", createdAt: t0 });
  assert.equal(canEdit(m, staff("a1")), true);
  assert.equal(canEdit(m, staff("a2")), false);
});
test("senders delete their own messages any time; moderators delete any non-system message", () => {
  const m = facts({ sender: "customer", createdAt: plus(t0, -30 * 86_400_000) });
  assert.equal(canDelete(m, customer), true);
  assert.equal(canDelete(m, staff("a1", true)), true);
  assert.equal(canDelete(m, staff("a1", false)), false);
  assert.equal(canDelete(facts({ sender: "staff", staffId: "a2" }), staff("a1", false)), false);
  assert.equal(canDelete({ ...m, deletedAt: t0 }, customer), false);
  assert.equal(canDelete(facts({ sender: "system" }), staff("a1", true)), false);
});
test("customer of another conversation can do nothing", () => {
  assert.equal(canDelete(facts({ sender: "customer", conversationId: "c2" }), customer), false);
});
test("online windows", () => {
  assert.equal(isOnline(plus(t0, -44_000), "customer", t0), true);
  assert.equal(isOnline(plus(t0, -46_000), "customer", t0), false);
  assert.equal(isOnline(plus(t0, -59_000), "staff", t0), true);
  assert.equal(isOnline(null, "staff", t0), false);
});
test("only photos and pdfs", () => {
  assert.equal(attachmentKind("image/svg+xml"), null);
  assert.equal(attachmentKind("text/html"), null);
  assert.equal(attachmentKind("application/msword"), null);
  assert.equal(attachmentKind("text/csv"), null);
  assert.equal(attachmentKind("image/png"), "image");
  assert.equal(attachmentKind("application/pdf"), "file");
});
test("preview text", () => {
  assert.equal(previewText({ body: "x", deletedAt: t0, attachmentKind: null, attachmentName: null }), "This message was deleted");
  assert.equal(previewText({ body: "", deletedAt: null, attachmentKind: "image", attachmentName: "a.webp" }), "Photo");
  assert.equal(previewText({ body: "y".repeat(100), deletedAt: null, attachmentKind: null, attachmentName: null }).length, 81); // 80 + "…"
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL (modules not found).
- [ ] **Step 3: Implement** `rules.ts`.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.

---

### Task 2: Data model, chat service and the order hook

**Files:**
- Modify: `prisma/schema.prisma`. New migration `prisma/migrations/<ts>_customer_chat/migration.sql`, generated with `prisma migrate diff`, as in the blueprint.
- Create: `src/lib/chat/types.ts` (client-safe DTO types), `src/lib/chat/realtime.ts`, `src/lib/chat/service.ts`, `src/lib/chat/service.test.ts`
- Modify: `src/lib/customer-orders.ts`: export `currentDeviceTokenHash(): Promise<string | null>` and `hasFullAccessOrder(tokenHash: string): Promise<boolean>`
- Modify: `src/app/actions/checkout.ts`: after `grantOrderAccess`, call `openOrderConversation(...)` inside `after()`

**Models** (fields as in the spec; listed here only where the spec leaves a choice):
- **`ChatConversation`**
  - `deviceTokenHash` (unique)
  - `customerId?` (SetNull on delete)
  - `customerName`, `customerEmail`
  - `lastMessageAt`, `lastMessagePreview`
  - `staffUnreadCount Int @default(0)`, `customerUnreadCount Int @default(0)`
  - `customerLastSeenAt?`
  - indexes on `lastMessageAt` and `customerId`
- **`ChatMessage`**
  - `id String @id` (uuid from the browser; the server makes one for system and automatic messages)
  - `sender ChatSender` (enum: `customer`, `staff`, `system`)
  - `staffId?` (AdminUser, SetNull)
  - `body String @default("")`
  - `attachmentKey?`, `attachmentName?`, `attachmentMime?`, `attachmentSize?`, `attachmentWidth?`, `attachmentHeight?`
  - `replyToId?` (self relation, SetNull)
  - `orderId?` (Order, SetNull)
  - `editedAt?`, `deletedAt?`, `deliveredAt?`, `readAt?`, `createdAt`
  - index on (`conversationId`, `createdAt`)
- **`ChatReaction`**: primary key (`messageId`, `by`), with `emoji`.
- **`ChatPresence`**: `id` (`customer:<conversationId>` or `staff:<adminId>`) and `lastSeenAt`.

**Interfaces:**
- **Produces from `types.ts`:**
  - `ChatMessageDTO = { id; sender: "customer" | "staff" | "system"; staffName: string | null; body: string; attachment: { url: string; name: string; mime: string; size: number; width: number | null; height: number | null; kind: "image" | "file" } | null; replyTo: { id: string; sender: string; preview: string } | null; orderId: string | null; edited: boolean; deleted: boolean; deletedBySelf: boolean; deliveredAt: string | null; readAt: string | null; createdAt: string; reactions: { by: "customer" | "staff"; emoji: string }[] }`
  - `ConversationDTO = { id; customerName; customerEmail; lastMessageAt; lastMessagePreview; staffUnreadCount; customerUnreadCount; customerLastSeenAt: string | null }`
  - `staffName` is `null` for customer viewers. Attachment URLs come from a `fileUrl(key)` argument, because customers and admins use different file routes.
- **Produces from `realtime.ts`:**
  - `publish(channel: string, event: string, data: unknown): Promise<void>`. A no-op without the env; errors are logged, never thrown.
  - `channels = { conversation: (id: string) => \`private-conversation-${id}\`, inbox: "private-admin-inbox", store: "store-status" }`. Export this from a client-safe `src/lib/chat/channels.ts` and re-export it here.
- **Produces from `service.ts`:**
  - `sendMessage(actor: Actor, input: { id: string; conversationId: string; body: string; replyToId?: string | null; attachment?: StoredAttachment | null }): Promise<ChatMessageDTO>`
  - `editMessage(actor, { id, body }): Promise<ChatMessageDTO>`
  - `deleteMessage(actor, { id }): Promise<ChatMessageDTO>`
  - `react(actor, { id, emoji: string | null }): Promise<void>`
  - `markReceipts(actor, { conversationId, kind: "delivered" | "read", upTo: string /* ISO */ }): Promise<void>`
  - `listMessages(conversationId: string, viewer: Actor, opts: { before?: string; after?: string; limit?: number }): Promise<ChatMessageDTO[]>`
  - `openOrderConversation(tokenHash: string, order: { id: string; number: number; totalCents: number; paymentMethod: string; customerId: string; fullName: string; email: string }): Promise<string>`
  - `StoredAttachment = { key; name; mime; size; width: number | null; height: number | null }`
  - Errors throw `ChatError` (`code: "FORBIDDEN" | "NOT_FOUND" | "TOO_LONG" | "EMPTY" | "RATE_LIMITED"`). A message is "empty" when it has no body and no attachment.

**Behaviour the tests pin:**
- **`sendMessage`:**
  - It is idempotent on `id`: resending the same id returns the existing row.
  - It updates `lastMessageAt`/`lastMessagePreview` and increments the other side's unread count.
  - It publishes `message` to the conversation channel and `inbox` + `badge` to the inbox.
- **`deleteMessage`:**
  - It wipes the body and attachment fields, deletes the stored object (via `files-sdk` `assets.delete`), and keeps the row.
- **`markReceipts`:**
  - It sets `deliveredAt`/`readAt` on the other side's messages created at or before `upTo` that are still null.
  - `read` also sets `deliveredAt` and zeroes the viewer side's unread count.
  - It publishes `receipts`.
- **`openOrderConversation`:**
  - It creates or reuses the conversation for `tokenHash`.
  - It inserts a `system` order message (`orderId` set) followed by the automatic `staff` message, with `staffId` null and the exact text from the spec.

- [ ] **Step 1: Write failing integration tests** in `service.test.ts`. They run against the real database, create conversations with a `test-` token hash, and delete them in `after()`.

```ts
test("send is idempotent and bumps the other side's unread", async () => {
  const m1 = await sendMessage(cust, { id: uuid1, conversationId: c.id, body: "hi" });
  const m2 = await sendMessage(cust, { id: uuid1, conversationId: c.id, body: "hi" });
  assert.equal(m1.id, m2.id);
  assert.equal((await convo(c.id)).staffUnreadCount, 1);
});
test("customer cannot write to another conversation", async () => {
  await assert.rejects(sendMessage({ kind: "customer", conversationId: other.id }, { id: uuid2, conversationId: c.id, body: "x" }), { code: "FORBIDDEN" });
});
test("body over 4000 chars and empty messages are refused", async () => {
  await assert.rejects(sendMessage(cust, { id: uuid3, conversationId: c.id, body: "a".repeat(4001) }), { code: "TOO_LONG" });
  await assert.rejects(sendMessage(cust, { id: uuid4, conversationId: c.id, body: "   " }), { code: "EMPTY" });
});
test("edit works on an old message and marks it edited; staff can't edit the customer's", async () => {
  await prisma.chatMessage.update({ where: { id: uuid1 }, data: { createdAt: new Date(Date.now() - 30 * 86_400_000) } });
  const e = await editMessage(cust, { id: uuid1, body: "changed" });
  assert.equal(e.body, "changed"); assert.equal(e.edited, true);
  await assert.rejects(editMessage(staffActor, { id: uuid1, body: "x" }), { code: "FORBIDDEN" });
});
test("delete keeps the row and hides content for both viewers", async () => {
  const d = await deleteMessage(cust, { id: uuid5 });
  assert.equal(d.deleted, true); assert.equal(d.body, ""); assert.equal(d.attachment, null);
  const [asStaff] = await listMessages(c.id, staffActor, { after: d.createdAt });
  assert.equal(asStaff.deleted, true); assert.equal(asStaff.deletedBySelf, false);
});
test("read receipts mark the other side's messages and zero my unread", async () => {
  await markReceipts(staffActor, { conversationId: c.id, kind: "read", upTo: new Date().toISOString() });
  const rows = await prisma.chatMessage.findMany({ where: { conversationId: c.id, sender: "customer", deletedAt: null } });
  assert.ok(rows.every((r) => r.readAt && r.deliveredAt));
  assert.equal((await convo(c.id)).staffUnreadCount, 0);
});
test("31st customer message in a minute is rate limited", async () => { /* send 30 then expect RATE_LIMITED */ });
test("order opens one conversation per device with order card and welcome", async () => {
  const id1 = await openOrderConversation("test-device-x", order1);
  const id2 = await openOrderConversation("test-device-x", order2);
  assert.equal(id1, id2);
  const msgs = await listMessages(id1, staffActor, {});
  assert.deepEqual(msgs.slice(0, 2).map((m) => m.sender), ["system", "staff"]);
  assert.equal(msgs[1].body, "Thanks! We'll send your payment details here within 5 minutes.");
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Apply the schema.**
  - Write the migration, check it only adds tables and columns, then run `npx prisma migrate deploy` and `npx prisma generate`.
  - Install `pusher@5.3.4`.
- [ ] **Step 4: Implement** `types.ts`, `channels.ts`, `realtime.ts`, `service.ts` and the `customer-orders.ts` exports.
  - Rate limiting: count the sender side's messages in the conversation over the last 60 seconds.
- [ ] **Step 5: Hook the order.** In `placeOrder`, after a successful order and `grantOrderAccess`, run `openOrderConversation(await currentDeviceTokenHash(), …)` inside `after()`.
- [ ] **Step 6: Run** `npm test`, `npx tsc --noEmit` and `npx eslint src/lib/chat src/app/actions`. Expected: all pass, no errors.

---

### Task 3: Customer access, routes and uploads

**Files:**
- Create: `src/lib/chat/access.ts` (server-only)
- Create: `src/lib/chat/files.ts` (server-only)
- Create: `src/app/actions/chat.ts` (customer server actions)
- Create routes:
  - `src/app/api/chat/route.ts` (GET snapshot)
  - `src/app/api/chat/status/route.ts` (GET)
  - `src/app/api/chat/upload/route.ts` (POST)
  - `src/app/api/chat/files/[...key]/route.ts` (GET)
  - `src/app/api/chat/presence/route.ts` (POST)
  - `src/app/api/pusher/auth/route.ts` (POST)
- Create: `src/lib/chat/presence.ts` (server-only)
- Test: `$SCRATCHPAD/shot/e2e-chat-api.mjs` (Playwright, the same style as `e2e-accounts.mjs`)

**Interfaces:**
- **`access.ts`:**
  - `customerActor(): Promise<{ kind: "customer"; conversationId: string } | null>`. Reads `bvsa_orders`, then finds the conversation by token hash. Returns null if there is none or the device has no full-access order.
- **`files.ts`:**
  - `storeChatFile(file: File, conversationId: string): Promise<StoredAttachment>`
    - Re-checks `attachmentKind` and `MAX_UPLOAD_BYTES`.
    - Images go through sharp: rotate, 2000 px inside, WebP quality 85.
    - The key is `chat/<conversationId>/<random12>-<slug(name)>.<ext>`.
  - `streamChatFile(key: string, opts: { download: boolean }): Promise<Response>`
    - Headers: `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=3600`.
    - `Content-Disposition` is inline for images and PDF, attachment otherwise.
- **`presence.ts`:**
  - `heartbeat(id: string, kind: "customer" | "staff"): Promise<void>`. Upserts `lastSeenAt`, and publishes only when the state flips online.
    - A customer flip goes to the inbox as `inbox` with `{ conversationId, customerLastSeenAt }`.
    - A staff flip goes to `store-status` as `presence`.
  - `leave(id, kind)`: the beacon that publishes the offline flip.
  - `storeStatus(): Promise<{ online: boolean; lastSeenAt: string | null }>`
- **`actions/chat.ts`:**
  - `sendCustomerMessage(input)`, `editCustomerMessage(input)`, `deleteCustomerMessage(input)`, `reactCustomer(input)`, `customerReceipts(input)`
  - Each one calls `customerActor()` first and maps `ChatError` to `{ ok: false, error }`.
  - The result type is `ActionResult<ChatMessageDTO | null>`.
- **Routes:**
  - `GET /api/chat?after=&before=` returns `{ conversation: { id, customerUnreadCount }, store: { online, lastSeenAt }, messages: ChatMessageDTO[] }`, or 404.
  - `GET /api/chat/status` returns `{ hasConversation, unread, conversationId }` with `Cache-Control: no-store`.
    - It also marks the store's undelivered messages as delivered (`markReceipts` with `kind: "delivered"`). This is the "phone was off, ticks arrive later" rule from the spec.
  - `POST /api/chat/upload` (multipart `file`) returns `{ ok, data: StoredAttachment }`. 413 for files over 4 MB, 415 for disallowed types.
  - `GET /api/chat/files/<key>` returns 404 unless the key starts with `chat/<the device's conversationId>/`.
  - `POST /api/pusher/auth` (form `socket_id`, `channel_name`) signs only `private-conversation-<own id>`, otherwise 403.

- [ ] **Step 1: Write the failing e2e test** `e2e-chat-api.mjs`:
  - Device A places an order, then `GET /api/chat/status` shows `hasConversation: true` and `unread: 1`. The welcome message is unread, and after the status call it has `deliveredAt` set.
  - `GET /api/chat` returns `system` then `staff` messages, and the order card carries `orderId`.
  - Device B (fresh, then after an email lookup) gets 404 from `/api/chat` and 403 from Pusher auth for A's channel.
  - A uploads a 1 MB PNG and gets `image/webp`. A 5 MB PDF gets 413. An SVG gets 415.
  - B requesting A's file URL gets 404. A gets 200 with `x-content-type-options: nosniff`.
  - With Pusher env set: A's Pusher auth for its own channel gets 200; for `private-admin-inbox` it gets 403.
- [ ] **Step 2: Run** `node e2e-chat-api.mjs http://localhost:3100` against a fresh `npm run build && npx next start -p 3100`. Expected: FAIL.
- [ ] **Step 3: Implement** the files above.
  - Pusher auth uses `pusher.authorizeChannel(socketId, channel)`, and returns 503 when Pusher isn't configured.
  - `/api/chat/presence` accepts `{ state: "beat" | "leave" }` through `sendBeacon`.
- [ ] **Step 4: Run the e2e test again.** Expected: all checks pass. Then run `npm test`.

---

### Task 4: Shared chat UI and the customer chat

**Files:**
- Create in `src/components/chat/`:
  - `use-chat.ts`: the conversation state hook
  - `pusher-client.ts`
  - `message-list.tsx`
  - `message-bubble.tsx`
  - `ticks.tsx`
  - `composer.tsx`
  - `emoji-picker.tsx` (frimousse)
  - `image-viewer.tsx`
  - `presence-line.tsx`
  - `chat-ui-store.ts` (zustand: `{ open, setOpen }`)
- Create: `src/components/chat/customer/chat-launcher.tsx`, `src/components/chat/customer/chat-panel.tsx`, `src/components/chat/customer/open-chat-on-load.tsx`
- Modify:
  - `src/app/(store)/layout.tsx`: mount `<ChatLauncher />` inside `Suspense`
  - `src/app/(store)/order/[token]/page.tsx`: render `<OpenChatOnLoad />`
  - `src/app/(store)/orders/page.tsx`: add a "Chat with us" button
- Test: `$SCRATCHPAD/shot/e2e-chat-customer.mjs`

**Interfaces:**
- `useChat(config: { side: "customer" | "staff"; conversationId: string; snapshotUrl: string; actions: ChatActions; live: boolean }): { messages: ChatMessageDTO[]; send(input: { body: string; replyToId?: string; attachment?: StoredAttachment }): void; retry(id: string): void; edit(id: string, body: string): void; remove(id: string): void; react(id: string, emoji: string | null): void; peerTyping: boolean; notifyTyping(): void; connection: "live" | "polling"; loadOlder(): Promise<void> }`
  - Messages are kept in a `Map` keyed by `id`. Optimistic sends carry `status: "sending" | "failed"`.
  - It polls `snapshotUrl?after=<newest createdAt>` every 4 s when `connection === "polling"`.
  - On Pusher reconnect it fetches `after=` once.
  - It calls the `receipts` action with `kind: "delivered"` for incoming messages, and `kind: "read"` only while `document.visibilityState === "visible"` and the panel is open.
  - `ChatActions` is `{ send, edit, delete, react, receipts }`, matching the customer or staff action signatures.
- `pusher-client.ts`:
  - `getPusher(side: "customer" | "staff"): Pusher | null`, with `authEndpoint` set to `/api/pusher/auth` or `/admin/api/pusher/auth`. Returns null without `NEXT_PUBLIC_PUSHER_KEY`.
  - For customers, a 10-minute linger timer starts after each send, as in the spec.
- `ChatLauncher`:
  - Fetches `/api/chat/status` on mount and every 30 s.
  - Renders only when `hasConversation` is true, as a floating round button bottom-right with an unread badge.
  - Opens `ChatPanel` in a `Sheet`: right side at `sm+`, full screen below.
  - Sends heartbeats every 25 s while the tab is visible, and the `leave` beacon on `pagehide`.

**UI decisions:**
- **Bubbles:** customer messages sit on the right in the accent colour; the store sits on the left on `surface-2`.
- **Labels:** each bubble shows its time, plus ticks on your own messages:
  - `CheckIcon` for sent
  - `ChecksIcon` in muted ink for delivered
  - `ChecksIcon` in `--primary-ink` for read
  - a `ClockIcon` while sending
- **Message actions** open from a long-press or a hover menu: Reply, React (quick six plus the picker), Copy, Edit (when `canEdit`), Delete (when `canDelete`, with a confirm dialog).
- **The list:**
  - date separators ("Today", "Yesterday", or "Thu 23 Oct")
  - an "Unread messages" divider
  - a jump-to-latest button with a count
- **The composer:**
  - an autosizing textarea; Enter sends, Shift+Enter adds a new line
  - an emoji button and a paperclip (`accept="image/*,application/pdf"`), accepting several files, each sent as its own message
  - reply and edit banners above the input
  - typing pings at most every 3 s
- **The order card:** shows the order number, total, payment method and a "View order" link (the device's own order link).

- [ ] **Step 1: Write the failing e2e test** `e2e-chat-customer.mjs`. It covers:
  - After placing an order, the confirmation page opens the chat panel. The welcome message is visible, and the status unread count drops to 0 after viewing.
  - Sending "hello" shows one bubble with one tick, then two ticks once an admin marks it delivered. An admin is simulated with an admin context that polls `/admin/api/chat/<id>`; that endpoint exists after Task 5, so this check is guarded until then.
  - `two tabs show one bubble`: the same device in two tabs, sending from tab 1, gives exactly one bubble in each tab after 6 s.
  - `failed send can be retried once`: route `**/chat` server action requests to abort, send, see "Not sent", restore the network, tap retry, and get exactly one bubble.
  - `xss body renders as text`: send `<img src=x onerror=window.__x=1>`, then check `window.__x` is undefined and the text is visible.
  - `long word wraps on mobile`: send 300 "a"s at 390 px, with no horizontal page scroll.
  - Editing shows "Edited". Deleting shows "You deleted this message".
  - Picking a Word or SVG file shows "Only photos and PDFs can be sent" and nothing is uploaded.
  - Emoji: pick 😂 from the picker and send it, and it appears.
  - Uploading a PNG shows an image bubble, and tapping it opens the viewer.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Install `pusher-js@8.6.0` and `frimousse@0.4.0`. Self-host the emoji data (frimousse `emojibaseUrl` pointing at a copy under `/public/emoji/`).
- [ ] **Step 4: Run** the customer e2e test, then `e2e-checkout.mjs` and `e2e-accounts.mjs` (regression). Expected: all pass.

---

### Task 5: The admin Chats page

**Files:**
- Create:
  - `src/app/actions/admin/chat.ts`
  - `src/app/admin/api/chat/inbox/route.ts`
  - `src/app/admin/api/chat/[id]/route.ts`
  - `src/app/admin/api/chat/upload/route.ts`
  - `src/app/admin/api/chat/files/[...key]/route.ts`
  - `src/app/admin/api/pusher/auth/route.ts`
- Create:
  - `src/app/admin/(panel)/chats/page.tsx`, `src/app/admin/(panel)/chats/[id]/page.tsx`
  - `src/components/admin/chat/inbox.tsx`, `src/components/admin/chat/thread.tsx`, `src/components/admin/chat/context-panel.tsx`
  - `src/components/admin/chat/chat-badge.tsx` (sidebar badge, sound, tab title)
- Modify:
  - `src/components/admin/shell/nav.ts`: add a "Sales" group with `{ href: "/admin/chats", label: "Chats", icon: ChatsCircleIcon }`
  - `src/components/admin/shell/sidebar.tsx`: render `<ChatBadge />` beside Chats, and send the staff heartbeat every 25 s
- Test: `$SCRATCHPAD/shot/e2e-chat-admin.mjs`

**Interfaces:**
- `actions/admin/chat.ts`:
  - `sendStaffMessage`, `editStaffMessage`, `deleteChatMessage` (moderators pass `canModerate` = `can(role, "people:manage")`), `reactStaff`, `staffReceipts`, `staffHeartbeat`
  - Each one calls `requireAdmin()` first.
- `GET /admin/api/chat/inbox?q=&unread=1` returns `{ conversations: ConversationDTO[] (most recent first, at most 100), unreadTotal: number }`. Search covers `customerName`, `customerEmail`, and the order number (digits matched against the conversation's orders).
- `GET /admin/api/chat/<id>?after=&before=` returns `{ conversation, messages, orders: { id, number, totalCents, status, paymentMethod, createdAt }[] (all orders for the customer's email), visitorId: string | null }`.
- `/admin/api/pusher/auth` signs `private-admin-inbox` and any `private-conversation-*` that exists, for admins only.

**UI decisions:**
- **Layout:**
  - At `lg+`: three columns. The list is 360 px, then the thread, then a 300 px context panel (collapsible at `lg`, always shown at `2xl`).
  - Below `lg`: the list only; tapping opens `/admin/chats/[id]` full screen with a back button.
- **Thread header:** customer name, online or "last seen", and typing.
- **Staff bubbles:** show the sender's name inside the admin.
- **`ChatBadge`:**
  - Subscribes to `private-admin-inbox` `badge` events, falling back to polling the inbox every 20 s.
  - When `unreadTotal` goes up: plays a short sound (a Web Audio beep, with no audio file) unless the user has muted it in `localStorage` `bvsa-chat-muted`, and sets `document.title` to `(n) …`.
  - Offers browser notifications through an opt-in toggle on the Chats page (`Notification.requestPermission`). Notifications are only shown while the tab is hidden.

- [ ] **Step 1: Write the failing e2e test** `e2e-chat-admin.mjs`, with two browser contexts (customer device and admin). It covers:
  - The inbox lists the customer's conversation with an unread count and the preview of their last message. Searching by order number finds it.
  - When the admin opens it, the customer sees two ticks in the accent colour within 6 s (polling) or 2 s (Pusher).
  - The admin replies, and the customer sees the reply with no staff name. The admin sees "Sent by Test Owner".
  - `hidden tab does not mark read`: emulate `document.visibilityState = "hidden"` in the admin tab, have the customer send, and check that after 6 s the message is delivered (two grey ticks) but not read.
  - Owner moderation: delete the customer's message, and the customer sees "This message was deleted".
  - Staff can't delete the customer's message, and the action returns a permission error.
  - The sidebar badge shows the unread total and clears after reading.
  - Mobile at 390 px: list, then tap, then thread full screen, then back.
  - The customer goes online: the green dot shows in the inbox within 30 s (heartbeat) and "Online" in the thread header. After the customer closes their tab, "last seen" is shown.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Reuse `useChat({ side: "staff" })` and the components from Task 4.
- [ ] **Step 4: Run** the admin e2e test and the customer e2e test (its Task 5 guard now passes), then `e2e-admin-products.mjs` and `e2e-admin-taxonomy.mjs` (regression). Expected: all pass.

---

### Task 6: Pusher live layer and the final checks

**Files:**
- Modify:
  - `src/components/chat/use-chat.ts`: subscribe while live, use client events for typing, and catch up on reconnect
  - `src/components/chat/customer/chat-launcher.tsx`: connection policy
  - `src/components/admin/chat/chat-badge.tsx`
- Modify: `ADMIN-BLUEPRINT.md`: record the chat module in `## Progress`
- Test: run `e2e-chat-customer.mjs` and `e2e-chat-admin.mjs` again with the Pusher env set

**Behaviour:**
- **Typing:** only works over Pusher; in polling mode no "typing..." is shown. `notifyTyping()` triggers `client-typing` with `{ side }` on the conversation channel, throttled to 3 s. The receiver shows "typing..." for 5 s after the last one.
- **Connection state:** if the connection state isn't `connected` for 5 s, switch to `"polling"`. When it is `connected` again, fetch `after=` and then switch to `"live"`.
- **Customers:** subscribe only while the panel is open, or within 10 minutes of the last send. Otherwise disconnect.
- **The store's online status:** subscribe to `store-status` while the panel is open.

- [ ] **Step 1: Add the e2e checks**, skipped when `NEXT_PUBLIC_PUSHER_KEY` is unset:
  - A message reaches the other side within 2 s.
  - Typing in the admin shows "typing..." on the customer within 2 s.
  - Disconnecting the customer's network shows "polling" (no UI error). Messages sent meanwhile appear after reconnecting, with no duplicates.
- [ ] **Step 2: Run without Pusher keys.** Expected: the checks are skipped, and every other check passes on polling.
- [ ] **Step 3: Implement** the behaviour above.
- [ ] **Step 4: Run with Pusher keys present** (once the owner adds them). Expected: all pass. If the keys aren't available yet, report that the Pusher-only checks were skipped.
- [ ] **Step 5: Final checks:**
  - `npm test`, `npx tsc --noEmit`, `npx eslint`, `npm run build`
  - every e2e suite: store pages, checkout, accounts, admin products, admin taxonomy, analytics, chat-api, chat-customer, chat-admin
  - delete the test data (conversations, orders, visitors and test accounts created by the tests)
