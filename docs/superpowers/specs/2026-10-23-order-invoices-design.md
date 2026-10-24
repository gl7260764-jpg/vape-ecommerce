# Order invoices and admin orders: design

Status: approved by the owner on 2026-10-23 ("Everything is okay"). Invoice look and admin order page approved from mockups. Calls marked **(builder's call)** were made by the builder, not the owner.

## Why

Customers pay by bank transfer or PayID after the team sends payment details in the chat. Before they pay, they should see exactly what they ordered and where it's going, and say whether it's right. Today the chat opens with a small order card, and when something is wrong (an old address, a missing item) nobody can fix it: the admin has no orders page. The owner wants a proper invoice as the first thing in the chat, a one-tap "is this correct?" step, and an admin Orders area where the team can fix an order and send the corrected invoice back into the chat.

## Goals

1. **A real invoice.** Every order gets an invoice that looks like the owner's reference (the Bourbon & Oak invoice), in Best Vape Shop's colours (lime instead of gold). It shows:
   - header: the store mark and name, "INVOICE", the invoice number, the store's business details, and the order number, issue date and terms ("Due on receipt")
   - a status badge ("PAYMENT DUE", "PAID", "CANCELLED", or "REPLACED" for an outdated invoice)
   - billed to (name, email, phone) and shipped to (name, full address, shipping option)
   - an item table (description, quantity, unit price, amount)
   - the payment method in its own box, with the note "Payment details are sent in your chat". The invoice never shows bank or PayID details.
   - subtotal, shipping, "GST included" (one eleventh of the total), and a black "Total due (AUD)" block
   - a footer reminding the customer to use the order number as the payment reference
2. **The invoice is the first chat message.** When an order is placed, the chat opens with the invoice (the phone layout from the approved mockup), with a button "Open full invoice · Save as PDF". Straight after it comes an automatic question with two buttons.
   - Question: "Please check your invoice. Are your items, delivery address and contact details all correct?"
   - Buttons: **"Yes, all correct"** and **"Something's wrong"**
3. **The customer's answer.**
   - "Yes, all correct": it appears as the customer's own message, the invoice and order are marked confirmed, and an automatic reply follows: "Thanks for confirming! We'll send your payment details here within 5 minutes." The team is alerted like any new customer message. The team then sends the payment details by hand, as today.
   - "Something's wrong": it appears as the customer's message "Something's wrong with my invoice", followed by the automatic reply "No problem. Tell us what needs changing and we'll send you an updated invoice." The message box is focused so they can type. The team is alerted.
   - Once answered, the buttons are replaced by the answer. A replaced invoice loses its buttons.
4. **Admin Orders list** (Admin > Sales > Orders): every order with number, customer, total, status and date; status tabs with counts; search by order number, name or email.
5. **Admin order page** (the approved mockup): an admin can change everything, then send the corrected invoice.
   - Items: add products (search the catalog), remove them, change quantities and unit prices. Subtotal and total recalculate.
   - Customer and delivery: name, email, phone, address line 1 and 2, suburb, state, postcode.
   - Shipping option (from the Shipping settings, which sets the shipping cost) and payment method.
   - Status: Awaiting payment, Paid, Packing, Shipped, Delivered, Cancelled.
   - **Save changes** stores the edits. **Send invoice to chat** posts a new invoice (the next revision number) into that customer's chat with the same question and buttons. The previous invoice in the chat is marked "Replaced by INV-…".
   - An invoice timeline: each invoice sent (automatically or by whom), each customer answer, status changes and edits (who and when).
   - View or print/save as PDF any invoice the order has had.
   - "Open chat" jumps to the conversation.
6. **Business details** (Admin > Settings, owner only): email, phone, postal address and ABN. The invoice header uses them. With an ABN set, the title reads "TAX INVOICE" and the ABN is shown. Until anything is filled in, the header shows the website only.
7. **Customers can find their invoice again.** The order page (/order/<token>) and My orders get "View invoice", which shows the latest invoice.

## Non-goals (not now)

- Emailing invoices (no email provider is set up).
- Generating PDF files on the server. "Save as PDF" uses the browser's print dialog on a print-styled invoice page **(builder's call)**.
- Payment details on the invoice, online payment, refunds, partial payments, a coupon system (a changed unit price covers one-off discounts), stock tracking.
- Customers editing their own order.

## Anti-goals (failures even if everything "works")

- A customer paying against an outdated invoice: a replaced invoice must be unmistakably marked, and its buttons must not work.
- An invoice changing after it was sent: each sent invoice is a frozen copy; edits only reach the customer as a new invoice.
- Totals that don't add up, or that the browser can set: the server computes every amount from the items, prices and shipping.
- Anyone seeing another customer's invoice, or an invoice link that can be guessed.

## Constraints

- Same stack and conventions as the chat (`docs/superpowers/specs/2026-10-23-customer-chat-design.md`, `ADMIN-BLUEPRINT.md`): Next.js 16 with cacheComponents, Prisma 7 on Neon, `requireAdmin()` first in every admin loader/action/route, `ActionResult`, no em dashes in UI copy, one accent colour, pill buttons, light and dark mode for the admin and the chat.
- The invoice document itself is always paper-white with the black header and lime rule, in both themes (it must print the same).
- Money is integer cents. GST shown = round(total / 11). Australian formats (en-AU, AUD).
- Editing an order needs `orders:write` (owner and staff). Business details need `settings:write` (owner).
- Invoice links for customers stay behind the same device access as the order page; admin invoice pages need an admin session.

## Decided by the owner

- The invoice looks like the reference layout, in the store's colours (mockup approved).
- The invoice shows the payment method only, never payment details.
- The customer is asked to verify the invoice, with a yes/something's wrong choice, before paying.
- When something is wrong, an admin fixes it on the order page, where every detail can be changed, and sends the regenerated invoice into the chat with a Send button.
- The full order page layout and invoice timeline (mockup approved).
- **Customers confirm before they pay.** While an order awaits payment, every invoice sent asks "is everything correct?". Until the customer taps "Yes, all correct", the order page and the chat header in the admin show "Not confirmed yet", so the team knows not to send payment details.
- **Changing an order after payment:** the new invoice goes into the chat without the question and keeps the PAID badge; if the total changed, the team settles the difference with the customer in the chat by hand. No amount-paid tracking.
- **Keep it simple.** Prefer the plainest version of every feature; nothing beyond what's described here.

## Builder's calls

- **Invoice numbers:** INV-<order number> for the first (INV-10053), then INV-10053-2, INV-10053-3.
- **Frozen copies:** each sent invoice stores a snapshot of everything it shows (business details, customer, address, items, totals, payment method). The status badge is the only live part: it follows the order's status (PAYMENT DUE / PAID / CANCELLED), or REPLACED once a newer invoice is sent.
- **Unit price editing** is allowed; a product added from the catalog starts at its current price.
- **Status names** reuse the existing order statuses: pending_payment "Awaiting payment", paid "Paid", processing "Packing", shipped "Shipped", delivered "Delivered", cancelled "Cancelled".
- **Editing stays open in every status.** When the order is paid or later, the page warns that changing items changes the total and that any difference is settled in the chat by hand.
- **Saving doesn't tell the customer anything.** Only Send does. When there are saved changes the customer hasn't been sent, the page says so. Send with unsaved edits saves first.
- **The buttons are real chat messages:** tapping one sends the customer's answer as their own message (so the team reads it in the thread), records it on the invoice, and adds the automatic reply.
- **Team alert:** an answer counts as a customer message (unread count, chime, preview "Invoice confirmed" / "Invoice: something's wrong").
- **New orders:** the invoice replaces the old order card and the old welcome message; existing chats keep their old cards. The "New order BV-…" alert for the team stays.
- **The timeline** records invoice sends, customer answers and status changes, with who and when.
- **Orders list:** 50 per page, newest first.
- **What customers see is what was sent.** Once an order has an invoice, the customer's order page and My orders show the details of the latest sent invoice (items, address, contact, totals); only the status is live. Saved edits reach the customer only when an invoice is sent.
- **Orders with no chat** (placed before the chat existed, or on a device that has no conversation): the Send button reads "Issue invoice" and creates the next invoice revision without a chat message; the customer sees it on their order page.
- **The question is only asked while an order awaits payment.** The chat-recovery check (`ensureOrderChats`) and any later send post the invoice without the question when the order is past awaiting payment.

## Left to the builder

Schema, component structure, how the invoice renders in the chat bubble versus the full page (one component with two layouts is fine), print styling, and any copy not quoted above.
