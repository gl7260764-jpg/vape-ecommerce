# Customer chat: design

Status: description approved in chat on 2026-10-23. Calls marked **(builder's call)** were made by the builder, not the owner.

## Why

Every order is paid by bank transfer or PayID. The confirmation page promises the store will send payment details "within 5 minutes, by email or live chat". Today nothing delivers on that: no email is set up and there is no chat. Customers need a fast, familiar way to talk to the store about their order, and the team needs one place to answer them. The owner asked for something that feels like WhatsApp.

## Goals

- **The chat opens straight after ordering.** When a customer places an order, the confirmation page opens their chat with the store, already showing a message about that order.
- **WhatsApp-like chat on both sides:**
  - text and emoji
  - photos and files
  - "online" and "last seen"
  - ticks: one grey for sent, two grey for delivered, two in the accent colour for read
  - "typing..."
  - replying to a specific message (a quoted preview)
  - emoji reactions
  - editing (marked "Edited")
  - deleting: the bubble keeps its place and reads "This message was deleted", or "You deleted this message" for the sender
  - unread counts, date separators, a jump-to-latest button, and a full-screen image viewer
- **A Chats page in the admin:**
  - a conversation list (latest first, last-message preview, time, unread count, online dot, search, an unread filter)
  - the open conversation
  - a context panel with the customer's orders (number, total, status) and a link to their visitor history
  - on phones, the list and then a full-screen conversation
- **Shared inbox.** Every team member sees every conversation. The customer sees replies from "Best Vape Shop"; the admin shows which team member sent each reply.
- **Alerts for the team.** A sound and a badge (sidebar plus tab title) when a new customer message arrives anywhere in the admin, plus opt-in browser notifications while the admin tab is open.
- **Customers can come back.** On the same device, through My orders and a chat button on every store page that shows unread replies.

## Non-goals (not now)

- Push notifications when the browser is closed. This needs a service worker and push keys; it's a later step.
- Group chats, calls, video, broadcast messages, forwarding, starring, link previews, or WhatsApp/SMS integration.
- Chat for visitors who haven't ordered.
- Bots and auto-replies, beyond the single automatic message when an order is placed.
- Voice notes. A later step: they need recording UX on phones and per-browser audio formats.

## Anti-goals (failures even if everything "works")

- Anyone reading or writing in someone else's conversation.
- Messages lost or stuck when the live connection drops.
- Chat files reachable by a guessable or shareable public URL.
- The chat slowing down store pages for people who never use it.

## Constraints

- **Stack:**
  - Next.js 16 with `cacheComponents`. Anything request-specific sits behind `<Suspense>`.
  - Prisma 7 on Neon Postgres in `us-east-2`.
  - Neon object storage bucket `assets`, which is private.
  - Tailwind v4, shadcn, Phosphor icons, sonner toasts.
- **Admin conventions:** follow `ADMIN-BLUEPRINT.md`.
  - `requireAdmin()` first in every admin loader, action and route.
  - The `ActionResult` envelope.
  - Admin routes under `src/app/admin/(panel)`.
- **Customers have no login.** Their identity is the private, httpOnly `bvsa_orders` device cookie (see `src/lib/customer-orders.ts`).
  - Orders placed on a device show in full there.
  - Orders found by email elsewhere show as summaries only.
  - Checkout does not verify email ownership.
- **Hosting is not decided.** The design must work on Vercel and on a plain Node server.
- **Images:** uploads already go through sharp (`src/app/admin/api/upload/route.ts` shows the pattern).

## Decisions

### Conversation scope and access **(builder's call)**

A conversation belongs to **a customer device**: one conversation per `bvsa_orders` token, linked to the customer account (email) of its orders.

- **Why per device:** checkout doesn't verify emails. If chats were per email, anyone could order with someone else's email and read or write in their chat.
- **Creation:** the conversation is created the first time that device places an order. More orders from the same device join the same conversation.
- **Same person, two devices:** the admin shows two conversations under the same customer name. The context panel lists all orders for the email.
- **Customer access:** only from the device holding the token. Devices that found orders by email get no chat access.
- **Admin access:** any signed-in admin.

### Live updates: Pusher Channels (owner's choice, 2026-10-23)

The database is always the source of truth. Every write (send, edit, delete, react, delivered, read) goes through a server action that saves to Postgres first. Only then does the server publish a small event through Pusher (`pusher` on the server, `pusher-js` in the browser), so instant delivery is an extra on top of storage.

**Channels**
- `private-conversation-<id>`
  - **Who can subscribe:** the customer device that owns the conversation, and admins.
  - **Events:** `message` (new or updated message), `reaction`, `receipts` (delivered/read up to a point in time), and the client event `client-typing`.
- `private-admin-inbox`
  - **Who can subscribe:** admins only.
  - **Events:** `inbox` (a conversation changed: preview, unread count, customer online status) and `badge` (the total unread count).
- `store-status`
  - Public. It carries the team's online state (`online`, `lastSeenAt`), which isn't sensitive.

**Authorising subscriptions**
- Customers: `POST /api/pusher/auth` checks the `bvsa_orders` cookie owns the conversation.
- Admins: `POST /admin/api/pusher/auth`. It lives under `/admin` because the admin cookie is scoped to that path, and it checks `requireAdmin()`.
- Every other channel is refused.

**Presence** (not Pusher presence channels, which cap members and would let customers see each other)
- Each side's open tabs send a heartbeat every 25 seconds while visible. A beacon on page hide updates `lastSeenAt`.
- The server publishes a change only when the state flips between online and offline:
  - customers to `private-admin-inbox`
  - the team to `store-status`
- Clients work out "online" as `lastSeenAt` within the last 45 seconds (customers) or 60 seconds (team).

**Typing:** a Pusher client event sent directly between the two sides. Nothing is written to the database. This needs "client events" enabled in the Pusher app settings.

**Fallback:** if the Pusher keys are missing or the connection drops for more than about 5 seconds, clients poll Route Handlers every 4 seconds while the chat is open (every 20 seconds for the unread badge). When Pusher reconnects, the client fetches any messages it missed since its last seen message, then stops polling.

**Requirements**
- A Pusher Channels app on the Sydney cluster (`ap4`), with client events enabled.
- Four values in the environment: `PUSHER_APP_ID`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`.
- Stay inside the free plan (100 connections at once, 200,000 messages a day) **(builder's call)**:
  - Customers connect to Pusher only while their chat panel is open, and for 10 minutes after they send a message. Otherwise their unread badge polls every 30 seconds.
  - Admin tabs always connect.
  - "Delivered" for a customer who isn't connected is marked on their next poll or page load, the way a phone that's off gets the ticks later.
  - If traffic ever outgrows the free plan, upgrading is an account setting, not a code change.

### Data model **(builder's call)**

**`ChatConversation`**
- `id`
- `deviceTokenHash` (unique)
- `customerId` (optional)
- snapshot of `customerName` and `customerEmail` (from the latest order)
- `lastMessageAt`, `lastMessagePreview`
- `staffUnreadCount`, `customerUnreadCount`
- `customerLastSeenAt`
- `createdAt`

**`ChatMessage`**
- `id`: a uuid created in the browser, so optimistic bubbles match live rows
- `conversationId`
- `sender`: `customer`, `staff` or `system`
- `staffId` (optional)
- `body`: up to 4,000 characters
- one optional attachment: `key`, `name`, `mime`, `size`, `width`, `height`, `kind` (image or file)
- `replyToId`
- `orderId` (optional; for order system messages)
- `editedAt`, `deletedAt`, `deliveredAt`, `readAt`
- `createdAt`

**`ChatReaction`**
- `messageId`
- `by`: `customer` or `staff:<adminId>`
- `emoji`
- primary key on (`messageId`, `by`)

**`ChatPresence`**
- `id`: `customer:<conversationId>` or `staff:<adminId>`
- `lastSeenAt`
- typing is a Pusher client event and is never stored

### Behaviour **(builder's call unless the owner specified it)**

**Ticks (owner)**
- Sent: saved on the server.
- Delivered: the recipient's client received it.
- Read: the recipient's chat was open and visible with the message on screen.
- The staff side counts as one recipient: the first team member who sees a message marks it.

**Online and last seen (owner)**
- **Customer online:** any store tab on their device sent a heartbeat in the last 45 seconds. Heartbeats go every 25 seconds only on devices that have a conversation.
- **Store online:** any admin tab sent a heartbeat in the last 60 seconds. Otherwise customers see "last seen" with the latest team activity.

**Typing:** a Pusher client event (`client-typing`) sent at most every 3 seconds while typing. The other side shows "typing..." for 5 seconds after the last one. Nothing is stored.

**Editing (owner, 2026-10-23)**
- Text messages can be edited at any time; there is no time limit.
- "Own" means the individual sender. A customer edits their own messages, and each team member edits only the messages they sent.
- An edit shows "Edited". No edit history is shown.

**Deleting (owner, 2026-10-23)**
- Senders can delete their own messages at any time; there is no time limit. "Own" means the individual sender, as with editing.
- The owner (`people:manage`) can delete any message, for abuse or to remove wrong details sent by a team member who has gone off shift.
- The body is wiped and any attachment is removed from storage.
- The row stays, so the bubble keeps its place.
- The sender sees "You deleted this message" only when they deleted it themselves. Everyone else sees "This message was deleted".

**Replies:** a quoted preview; tapping it scrolls to the original. Replies to deleted messages show the placeholder.

**Reactions:** one per side per message. Six quick ones plus the full emoji picker (`frimousse`, self-hosted emoji data).

**Order message (owner)**
- Placing an order adds a system card to the device's conversation: order number, total and payment method.
- It is followed by an automatic store message: "Thanks! We'll send your payment details here within 5 minutes."

**Files** (owner, 2026-10-23: photos and PDFs only; the 4 MB cap is the builder's call, because Vercel refuses request bodies over 4.5 MB and uploads go through the app)
- **Photos:** JPG, PNG, WebP, HEIC as converted by the browser, or GIF shown as a still.
  - The browser shrinks them to at most 2000 px first.
  - The upload itself must be 4 MB or less.
  - The server re-encodes to WebP with location data (EXIF) removed.
  - A file the browser can't shrink and that is over 4 MB is refused with a clear message.
- **PDFs:** up to 4 MB, stored as they are.
- **Anything else** is refused with a message saying only photos and PDFs can be sent.
- **Several files at once:** each one becomes its own message.
- **Storage:** under `chat/<conversationId>/`. Files are served only through an access-checked route, never `/media`.
- **Uploads:** proxy only, after resizing in the browser.

**Limits:** customers can send 30 messages a minute per conversation, and staff 60.

**Customer UI**
- A chat panel: a right-side sheet on desktop, full screen on phones.
- It opens automatically on the order confirmation page. Elsewhere it's reached from a floating chat button with an unread badge (only on devices that have a conversation) and from My orders.
- The header shows "Best Vape Shop" with online/last seen and typing.

**Admin UI**
- `/admin/chats` and `/admin/chats/[id]`, with a sidebar "Chats" item and an unread badge.
- Search covers customer name, email and order number.

## Left to the builder

- Component structure, animations and exact visual details. They must follow the existing store and admin design language, and avoid copying WhatsApp's look.
- How older messages page in (newest 200 live, older ones fetched on scroll).
- Test strategy, which must cover two devices, two admins, file access denial, and edit/delete windows.

## Resolved

- **Owner changes (2026-10-23):**
  - Messages can be edited and deleted at any time (no time windows).
  - Files are photos and PDFs only.
  - The payment details settings page and quick reply are dropped: the team types payment details into the chat.

- **Review questions (2026-10-23), settled by the builder:** the upload size cap, who "own" means for editing and deleting, and staying inside Pusher's free plan. See Files, Editing, Deleting, and the Pusher requirements above.

- **Live updates:** the owner chose Pusher over Neon Realtime on 2026-10-23. No database setting changes are needed.
