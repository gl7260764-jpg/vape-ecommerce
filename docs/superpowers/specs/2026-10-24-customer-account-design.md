# Customer account and message icon: design

Status: approved by the owner in chat on 2026-10-24 ("ok" to the account and email-only sign-in playback, "yes proceed" to the mockup `.superpowers/brainstorm/651275-1792849789/content/account-and-messages.html`). Calls marked **(builder's call)** were made by the builder, not the owner. App installation (PWA) is a separate project that comes after this one.

## Why

The owner wants every subscriber to have an account they can open, where they chat with the store's team, not only people who have already ordered. While they browse, they should see at a glance that the team has written to them: a message icon in the navbar with a count, on desktop and phone. The owner asked for the simplest version: an email opens the account, nothing more. Stronger sign-in (email codes) comes later.

## What exists today

- **Accounts:** a `Customer` row per email, made by the first order (no password; name and phone required, taken from the latest order).
- **The device:** a private cookie (`bvsa_orders`) identifies the browser. Orders placed on it show in full on "My orders" (`/orders`); orders found there by typing an email show as summaries only (no street address, phone or order link). "Remove my orders from this device" forgets it.
- **The chat:** one conversation per device (`ChatConversation.deviceTokenHash`), opened by the device's first order with the invoice as its first message. Only a device that placed an order itself has a chat (`customerActor` in `src/lib/chat/access.ts`). A floating chat bubble (`ChatLauncher`) appears on that device with the unread count, live through Pusher with polling as the fallback. The team answers in Admin › Chats.
- **Subscribing** (footer or pop-up) adds a `Subscriber` and saves 10% off the next order; it creates no account.

## Goals

1. **Subscribing creates the account** (pop-up and footer): a `Customer` for that email if there isn't one, and the device they subscribed on is signed into it.
2. **An account icon in the navbar** on desktop and phone (it replaces today's "My orders" receipt icon):
   - On a device with no account: it opens a small "Your account" panel. Copy: "Enter your email to open your account. New here? This creates one." An email box, a **Continue** button, and the small line "Subscribed already? Use the same email." Continue creates the account or opens the existing one, signs this device in, and opens the account page.
   - On a signed-in device: it goes to the account page.
3. **The account page** shows their email, their chat with the team (a "Chat with us" card with the latest message, the number of new messages and an **Open chat** button), their orders (today's "My orders" list) and **Sign out on this device**.
4. **A message icon in the navbar** on desktop and phone, shown only on a signed-in device. It carries the number of team messages they haven't read ("2", "3"…), updates live while they browse, and opens the chat. It takes over from the floating chat bubble.
5. **Signed-in devices can chat**, including ones that never ordered. Their chat appears in Admin › Chats like any other; until the account has a name from an order it shows the email, tagged **Subscriber** when the email is subscribed (otherwise **New account**), with "No messages yet" until someone writes. The team can write first.
6. **Ordering keeps working as now:** the order's invoice opens or joins that device's chat, and the order joins the same account.

## Non-goals (not now)

- Email codes, magic links or passwords (no email provider yet; the owner will tighten sign-in later).
- One chat history shared across a person's devices.
- Editing name, phone or address in the account.
- The account icon or sign-in subscribing anyone to the newsletter.
- Push notifications outside the open site (the app installation project).
- An admin Customers page.

## Anti-goals

- **Typing someone else's email reveals their private details.** Anyone can type any email, so an email-only sign-in on a new device must never show earlier messages, invoices, street addresses, phone numbers or full order details made on another device. It gets its own new chat and order summaries only, exactly what "find my orders" shows today.
- **The team being fooled without a hint:** a chat from a device that hasn't placed an order is visibly marked in the inbox, so the team doesn't treat it as proven.
- **Breaking the order chat:** the invoice as the first message of an order, "is everything correct?", Yes / Something's wrong, and the admin's invoice revisions all behave as today.
- **Account icons that flicker or lie:** no message icon or count for visitors without an account, and no count that disagrees with the chat.
- **A device silently switching accounts:** subscribing with a different email on a signed-in device doesn't move that device to the other account.

## Constraints

- Same stack and conventions as the rest of the store and admin (`ADMIN-BLUEPRINT.md`, the chat, invoice and newsletter specs): Next.js 16 with cacheComponents, Prisma 7 on Neon, server actions validate everything again, no em dashes, one accent colour, pill buttons, light and dark mode, the Phosphor icon set.
- No passwords and no email sending.
- Reuse the existing device cookie, chat, realtime (Pusher plus polling) and "My orders" code; don't build a second chat.
- Sign-in by email is rate-limited per IP and per email, like "find my orders", so nobody can work through a list of emails.
- The owner asked for the simplest version of everything.

## Decided by the owner

- Subscribing creates the account.
- An account icon in the navbar; an email alone creates the account or logs into it, and the account opens.
- In the account they chat with the team.
- A message icon with the number of new messages in the navbar, on desktop and phone.
- Email-only sign-in for now with the new-device rule (a new device gets its own chat; older messages and invoices stay on the device they were made on); stronger sign-in later.
- The mockup, including the calls shown in it (account icon replaces "My orders", message icon replaces the floating bubble, new accounts appear in Admin › Chats tagged so the team can say hello).

## Builder's calls

- **What "signed in" means:** the device has a chat conversation (`deviceTokenHash`) linked to the account. Devices that ordered before this change are already signed in, to the email of their latest order.
- **The account record:** `Customer.name` and `Customer.phone` become optional, so an account can start with just an email; the first order fills them in as today.
- **Chat for devices without an order:** `customerActor` allows any device with a conversation. A device still only ever reads its own conversation, and invoices still go only to the chat of the device that placed the order.
- **Signing in:** one server action takes the email (validated and lowercased like the checkout), checks the rate limit, creates the `Customer` if needed, signs the device in (cookie plus conversation), adds that email's orders to the device as summaries, then the browser opens the account page. A wrong or new email simply makes a new account; there's no "not found".
- **Already signed in:** the account icon goes to the account page; signing into another email means signing out first. Subscribing with another email on a signed-in device subscribes that email and creates its account, but the device stays in its current account.
- **The account page** lives at `/account`; `/orders` goes there, so old links keep working. The "find my orders" box is replaced by the sign-in, which does the same job.
- **Sign out on this device** is today's "Remove my orders from this device": it forgets the device. The chat stays with the team, and signing in again on that device starts a new chat.
- **The message icon** reads the same unread count and live updates the floating bubble used; the floating bubble is removed. The chat still opens in the same panel.
- **Inbox name:** a conversation shows the account's name once an order gives one, the email before that.
- **Inbox marking:** the Subscriber / New account tag shows while that device hasn't placed an order, with a short note beside the open conversation that the email was typed, not proven by an order.
- **Rate limit:** the same numbers as "find my orders" (15 per IP, 10 per email, per 15 minutes).
- **Ordering with a different email on a signed-in device** (after the builder check): as today, the order goes to the account of the email typed at checkout, and the device follows it to that account. No checkout change.
- **Subscribing signs in through the same step,** including the rate limit: when it's hit, the subscription still saves but the device isn't signed in (so the newsletter forms can't be used to look up orders without a limit).
- **The account page brings in the account email's other orders as summaries** each time it opens, so a device that ordered before this change still sees orders placed elsewhere with its email, now that the "find my orders" box is gone.

## Left to the builder

Schema details and migration, component structure, the exact icons, animation, the sign-in panel's form on phones (sheet or dialog), the wording of the inbox note, how the header learns the signed-in state, and copy not quoted above.
