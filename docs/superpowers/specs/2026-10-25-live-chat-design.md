# Live chat for every visitor: design

Status: approved by the owner in chat ("I like it that way"; "yes" to the mockup `.superpowers/brainstorm/80313-1792879793/content/live-chat.html`). Calls marked **(builder's call)** were made by the builder.

## Why

Today only a device with an account (it ordered, subscribed or signed in) can chat. The owner wants every visitor to be able to start a chat straight away, so questions turn into accounts and orders, and wants a visible, gently animated chat button so people notice it.

## Goals

1. **A floating chat button** at the bottom right of every store page, for every visitor. It pulses until the visitor has opened it once on that device **(builder's call)**, then stays still. With unread team messages it shows the count.
2. **The chat window:** on computers a floating window above the button (about 400 × 600, like the owner's example); on phones full screen. Escape and ✕ close it; the page behind stays usable on computers. The navbar message icon (unread count) stays and opens the same window.
3. **First time (no account on this device):** header "Best Vape Shop" with "We usually reply in a few minutes", an empty state "Start the conversation" with "Hi! Questions about a flavour, an order or delivery? Send us a message and a real person will reply.", then an email box ("Your email, so we can reply"), a message box ("Type a message…") and a send button, with the fine print "Sending opens your account with this email. Adults 18+ only."
4. **Sending the first message** creates the account for that email (or signs this device into it), saves the message in this device's chat, and the window switches to the conversation, where the team's replies arrive as in the order chat today. The team sees it in Admin › Chats with the email (tagged as today) and the message as its preview.
5. **Coming back** on that device opens straight to the conversation, no email box. A line under the header says "Chatting as <email>".
6. Names follow later: the inbox shows the email until their first order gives a name (as today).

## Non-goals

- Proving the email (no codes; same rule as the account).
- Chat outside the store pages (the admin), chatbots, canned replies, chat hours.

## Anti-goals

- **Another person's chat or details on a new device:** a typed email on a new device gets its own new chat (the account rule).
- **Spam floods:** the same sign-in limit (15 per IP, 10 per email per 15 minutes) and a hidden trap field for bots; empty or overlong messages refused.
- **Covering other things:** the button sits above the product page's sticky buy bar and above the install card on phones; while the chat is open no pop-up opens over it.
- **Breaking the order chat:** invoices, "is everything correct?", photos, emoji, receipts and live updates keep working.

## Builder's calls

- The pulse stops for good once the window has been opened on that device (localStorage).
- A device already signed in never sees the email form; the first message goes to its chat.
- The window is non-modal on computers (Radix dialog without the page lock), full-screen modal on phones.
- The first message is saved by one server action that opens the account and sends the message together; the browser then loads the conversation.
- The "unavailable" chat text becomes "Start a new chat from the chat button." (it used to point to the device that ordered).
- **After the builder check:**
  - **Hearing back after leaving:** right after the first message, the chat offers "Get notified when we reply" (the existing notifications, where the browser supports them); otherwise the button's unread count tells them when they return. Reply emails need an email provider and are a later step.
  - The navbar message icon is unchanged (signed-in devices only); the first message is text only (photos once the chat exists); the button appears after the 18+ check; the order page's "open the chat" still waits for the order's chat rather than showing the form; clicking the page behind doesn't close the window on computers (Escape and ✕ do).

## Left to the builder

Component structure, animation, exact spacing, the phone/desktop breakpoint, error copy.
