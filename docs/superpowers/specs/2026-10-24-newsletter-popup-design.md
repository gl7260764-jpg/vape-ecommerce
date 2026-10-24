# Newsletter pop-up and subscriber discount: design

Status: approved by the owner on 2026-10-24 ("Yes", after the builder check; the mockup `.superpowers/brainstorm/1936979-1792775812/content/newsletter-popup.html`). Calls marked **(builder's call)** were made by the builder, not the owner. App installation is a separate project that comes next.

## Why

The owner wants more email addresses. A pop-up invites visitors to subscribe for new releases, restocks and deals, and rewards them with 10% off their next order. The owner wants to control how hard the pop-up pushes: it can keep coming back until the visitor subscribes, or give up after a set number of times. The team should see who subscribed when looking at visitors.

## Goals

1. **The pop-up** (approved mockup): a lime "10% off your next order" panel, the heading "Get 10% off your next order", the line "Subscribe for new releases, restocks and deals. Your 10% is applied automatically at checkout.", an email box, a **Subscribe and save 10%** button, **No thanks** and an ✕. Small print: "One discount per email. Unsubscribe any time." On phones it slides up from the bottom.
2. **After subscribing** the pop-up says: "You're in! 10% off your next order is saved to <email>. Use that email at checkout and it comes off automatically." with a **Start shopping** button. It never shows again on that device.
3. **10% off the next order after subscribing**, once per email, for new and returning customers alike (owner). It applies automatically when the checkout email matches a subscriber whose discount hasn't been used: no code. It is 10% of the items, not shipping **(builder's call, agreed in chat)**. Existing subscribers (from the footer sign-up) get it too.
4. **The discount is visible** as its own line, "Newsletter discount (10%)" with the amount taken off, in the checkout summary (as soon as the email is entered), on the invoice, on the order page and in the admin order page. The total is after the discount; GST is still one eleventh of the total.
5. **Admin > Settings > Newsletter pop-up** (owner only):
   - **Show the pop-up**: on/off. Off hides it everywhere; the footer sign-up still gives the 10%.
   - **First show after**: seconds on the site (default 8).
   - **If they close it, show it again every**: seconds (default 10).
   - **Keep showing it**: **Until they subscribe** (comes back forever while they browse), or **A set number of times** with a number (it stops for good once that device has seen it that many times).
6. **Visitors**: the Visitors table and a visitor's page mark subscribers and show when they subscribed. This already exists; pop-up sign-ups go through the same sign-up, so they appear there too, recorded with the source "popup".

## Non-goals (not now)

- Sending emails (no email provider is set up), unsubscribe links, double opt-in.
- Discount codes, a configurable percentage, other promotions.
- Stopping people from using a new email for each order to get 10% again.
- App installation (next project).

## Anti-goals

- The pop-up interrupting a purchase: it never shows on the checkout, order, My orders or invoice pages, and never over the 18+ age check.
- Anyone getting the discount twice for one email, including two orders placed at the same moment.
- Totals that don't add up anywhere (checkout, order, invoice, admin): the server computes the discount.
- A pop-up that can't be closed or traps keyboard users: Escape and ✕ close it, focus returns to the page.

## Constraints

- Same stack and conventions as the rest of the store and admin (`ADMIN-BLUEPRINT.md`, the chat and invoice specs): Next.js 16 with cacheComponents, Prisma 7 on Neon, `requireAdmin()` first, `ActionResult`, no em dashes, one accent colour, pill buttons, light and dark mode.
- The pop-up must not slow the store for people who never see it (load its code when it's about to show).
- Money is integer cents. Discount = round(items subtotal × 10 / 100). Total = subtotal − discount + shipping.
- Settings need `settings:write` (owner).
- The owner asked for the simplest version of everything.

## Decided by the owner

- 10% off the next order after subscribing, for new and existing customers, shown at checkout and on the invoice.
- The pop-up keeps returning on an admin-set interval, either until they subscribe or for an admin-set number of times.
- The pop-up design and admin settings in the mockup.
- Subscribers are marked on the Visitors page.

## Builder's calls

- **Matching:** by the email typed at checkout (lowercased), against a subscriber whose discount hasn't been used. The discount is spent when the order is placed; cancelling that order doesn't give it back.
- **Race-safe:** the discount is claimed in the same step that creates the order, so two orders at once can't both get it.
- **Order edits:** the order keeps "10% off" as a percentage; when the admin edits items, the discount is 10% of the new items subtotal. No admin switch to remove it.
- **What "a set number of times" counts:** times the pop-up has opened on that device, ever (kept in the browser). "Until they subscribe" ignores the count.
- **Remembering a device:** the browser keeps whether this device subscribed, how many times the pop-up has shown, and when it was last closed; a page reload continues the countdown rather than starting over.
- **Where it never shows:** /checkout, /order/*, /orders, /invoice/*, the admin, before the age check, and when switched off.
- **Checkout preview:** the summary checks the typed email once it looks complete and shows the discount line if it qualifies. The server decides again when the order is placed.
- **Subscribers added by the team** (Admin > Subscribers > Add) qualify too: the rule is any subscriber whose discount hasn't been used.
- **"No thanks" works like ✕:** it closes the pop-up, which comes back on the interval.
- **An email whose 10% was already used** can still subscribe; the pop-up then says so honestly ("You're subscribed. Your 10% welcome discount was already used on an earlier order.") instead of promising it.
- **If the preview showed 10% but it no longer applies when the order is placed** (another order used it a moment earlier), the order isn't placed; checkout shows the new total and asks them to place it again, the same way it handles items that sold out.
- **Used discounts are remembered by email, separately from the subscriber list,** so removing a subscriber and signing up again doesn't give a second 10%.

## Left to the builder

Schema, component structure, animation, the exact settings validation ranges (sensible minimums so the interval can't be zero), and copy not quoted above.
