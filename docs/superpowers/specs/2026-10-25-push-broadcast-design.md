# Admin push notifications for products: design

Status: approved by the owner in chat (the mockup `.superpowers/brainstorm/392150-1792904524/content/push-notifications.html`, plus "I want the image of the product to show in the notification"). Calls marked **(builder's call)** were made by the builder.

## Why

People who installed the app and turned notifications on can be reached on their phone. The owner wants to keep the app alive by sending them products: open a page in the admin, press Push on a product, and it shows on their phones.

## Goals

1. **Admin › Push notifications** (Marketing section): how many devices have notifications on and when the last push went; a product search and list (photo, name, price, stock, "Sent <when>" if pushed before) with a **Push** button each.
2. **Push** opens a box: title (prefilled "Just in: <product name>") and message (prefilled "<price>. Tap to see it."), both editable; a preview of the notification; **Send to N devices** and Cancel.
3. **The notification** shows the title and message with the product's photo (Android and Windows show it large; iPhone and Mac show the store icon only, an Apple limit). Tapping it opens the product page.
4. **History:** the page lists recent pushes: product, title, who sent it, how many were delivered, when.

## Non-goals

- Scheduling, audiences or segments, pushes without a product, A/B tests, analytics beyond the delivered count.

## Anti-goals

- **Sending by accident or twice:** one confirm step showing the device count; the button is disabled while sending; each product shows when it was last pushed.
- **Reaching people who didn't agree:** only devices that turned notifications on; the opt-in wording says product news is included.
- **Dead subscriptions piling up:** 404/410 deletes them, as for chat and order notifications.

## Builder's calls

- Owner only (`settings:write`), like the other marketing settings that affect every customer.
- Title up to 60 characters, message up to 160; the product must exist.
- The notification links to `/product/<slug>`; the photo is the product's main image (`/media/<key>`), sent as the notification's `image`.
- The opt-in wording changes to "Get told when we reply, your order ships, or new products land." wherever notifications are offered (account card, in-app card, install pop-up tick).
- Sending happens in the server action (a few hundred devices is quick); the history row is written with the delivered count.

## Constraints

- The existing push setup (`src/lib/push.ts`, `web-push`, VAPID keys); the service worker passes the image through.
- Advertising rules: Australia restricts advertising nicotine/vape products to the public; the owner confirms compliance before using this (told in chat).
