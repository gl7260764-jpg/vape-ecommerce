# Install the app, notifications and the app discount: design

Status: approved by the owner in chat on 2026-10-24 ("so good let go" to the playback and the mockup `.superpowers/brainstorm/651275-1792849789/content/install-the-app.html`). Calls marked **(builder's call)** were made by the builder, not the owner. Groundwork research: the PWA findings report from 2026-10-24 (summarised under "Facts the design rests on").

## Why

The owner wants shoppers to install the store as an app on their phone or computer, so they come back more easily and can get notifications. Installing is rewarded with 10% off, on top of the newsletter's 10%. The team should see in the Visitors page who installed the app and who turned notifications on.

## Facts the design rests on

- The store is a Next.js 16 app. It becomes installable with a web app manifest (`src/app/manifest.ts`), app icons and a small service worker (`public/sw.js`). Nothing like this exists yet.
- **Chrome, Edge, Samsung Internet and Opera** (Android and desktop) can show their own install prompt from a button (`beforeinstallprompt`), once Chrome's conditions are met (it can take a tap and ~30 seconds on a first visit).
- **iPhone, iPad and Mac Safari, and Firefox,** can't be prompted. iPhone/iPad: Share (or ••• → Share) → Add to Home Screen → Add. Mac Safari: File (or Share) → Add to Dock. In-app browsers (Instagram, TikTok, Facebook) can't install at all.
- **Inside the installed app,** `display-mode: standalone` (and `navigator.standalone` on iOS) is true; Chromium also fires `appinstalled` at the moment of install. These are the only signals, and they come from the browser.
- **Push notifications** need a service worker, VAPID keys and the `web-push` library; the permission must come from a tap. On iPhone/iPad they work only inside the installed app (iOS 16.4+).
- On iPhone and Mac the installed app has its own storage; it may start without the browser's cookies, so it can be a new device to the store.

## Goals

1. **The store installs as an app** named "Best Vape Shop Australia" (short name "Best Vape"), opening full screen at the home page in the store's dark theme, with the lime "B" as its icon **(builder's call, until a real logo exists)**. Offline, it shows a simple "You're offline" page.
2. **Before they subscribe: a card at the bottom** of every store page from the first visit (mockup 1 and 2): the app icon, "Get the app, get 10% off", "Faster ordering and order updates.", an **Install** button and ✕. ✕ hides it until their next visit **(builder's call)**.
3. **An install icon in the navbar** on desktop and phone that pulses gently until the app is installed. It does exactly what the card's Install button does.
4. **After they subscribe** (pop-up or footer), the bottom card goes away and an **install pop-up** takes its place (mockup 3): "YOU'RE SUBSCRIBED", "Install the app and make it 20% off", three ticks ("20% off your next order (10% + 10%)", "Notifications when we reply or your order ships", "One tap from your home screen"), **Install the app** and **Not now**. It comes back on the same timing as the newsletter pop-up (Admin › Settings › Newsletter pop-up) until they install **(builder's call)**.
5. **The Install button** opens the browser's own install prompt where it can. Otherwise it shows short steps for that device (mockup 4): iPhone/iPad "Add to Home Screen", Mac Safari "Add to Dock", other browsers "use your browser's menu → Install app", and in-app browsers "open this page in Safari or Chrome".
6. **Inside the installed app** every install offer is gone, and the app records that this device installed it.
7. **10% off for installing**, added to the newsletter's 10%: subscribed and installed is 20% off the next order. Still one welcome discount per email, decided on the server and claimed with the order as today.
8. **Notifications:** inside the installed app (and in desktop browsers that support it) a "Turn on notifications" button. Once on, they are told when the team replies in their chat and when their order is paid, shipped or delivered **(builder's call: the owner didn't specify)**.
9. **Admin › Visitors** shows "App" (with the device, e.g. iPhone) and "Notifications" tags on the list and the visitor page (mockup 5), and the visitor's activity lists "Installed the app" and "Turned on notifications".

## Non-goals (not now)

- Promotions or announcements sent from the admin (only automatic chat and order notifications).
- Offline browsing beyond the "You're offline" page; caching pages or prices.
- App store apps, a real logo, splash-screen artwork.
- Stopping someone from claiming "installed" without installing (the reward is the same one-time 10% they'd get by installing).

## Anti-goals

- **Covering a purchase or the age check:** no card, pop-up or prompt on checkout, order, account or invoice pages, before the 18+ check, or on top of the newsletter pop-up or another dialog.
- **Stale prices:** the service worker never serves cached pages, prices or carts; only the offline page is cached.
- **Notifications nobody asked for:** permission is only requested from a tap; no silent pushes; turning it off in the browser or phone settings is respected.
- **Private details on the wrong device:** an order notification goes only to the device that placed the order; a chat notification only to that chat's device.
- **A second welcome discount:** the newsletter and app 10%s are one discount per email, used once.
- **Breaking browsers without the features:** with no service worker, push or install support, the store works exactly as now.

## Constraints

- Same stack and conventions as the rest of the store (`ADMIN-BLUEPRINT.md`; the newsletter, account and chat specs): server actions validate again, no em dashes, one accent colour, pill buttons, light and dark mode, Phosphor icons.
- New: the `web-push` library and two settings, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, generated once (changing them later cancels every subscription). They must also be set on the live host.
- Installing and push need HTTPS (localhost is fine for testing). iPhone behaviour can only be checked on a real deployed site.
- The owner asked for the simplest version of everything.

## Decided by the owner

- The bottom card from the first visit with ✕; the pulsing navbar install icon; after subscribing, the card is replaced by an install pop-up like the subscriber pop-up.
- Installing gives 10%; subscribing and installing gives 20%.
- One Install button; where it can't install directly, a short tutorial (iPhone especially).
- The Visitors page shows who installed the app and turned on notifications, on phone and desktop.

## Builder's calls

- **Where the discount is decided:** at checkout (quote and place order), percent = 10 if the email is a subscriber, plus 10 if "installed", 0 if the email already used its welcome discount. "Installed" means the device placing the order has installed the app, or the email's account has (`Customer.appInstalledAt`, set when an installed device is signed into that account).
- **The discount line** names what it's for: "Newsletter discount (10%)", "App discount (10%)" or "Newsletter + app discount (20%)". The order keeps that label (and the invoice snapshot), so old orders keep reading "Newsletter discount".
- **Someone who already used their 10%** gets nothing more by installing (one welcome discount per email).
- **Recording an install:** the first time the store runs as the installed app on a device (or Chromium's `appinstalled`), a server action records it on that visitor (date and platform) and on the account the device is signed into, and logs an "Installed the app" event.
- **The card's ✕** hides it for the rest of the visit (a new visit is a new browser session); the install pop-up's Not now / ✕ / Escape behave like the newsletter pop-up's.
- **One switch:** Admin › Settings › Newsletter pop-up gains "Show the app install card and pop-up" (on by default). Off hides the card, the pop-up and the navbar icon; the app and its discount still work.
- **Notifications** are offered inside the installed app (a small "Turn on notifications" card on the account page and once after install) and in browsers that support push. A subscription belongs to the device (its cookie), so it follows that device's chat and orders. Dead subscriptions (404/410 from the push service) are deleted when sending.
- **Chat notifications** go out for team messages only, not while the customer has the chat open, at most one per conversation per minute. **Order notifications** go out when the team sets an order to paid, shipped or delivered.
- **The install pop-up** uses the same look as the newsletter pop-up and the same device memory (localStorage), with its own counter.
- **After the builder check:**
  - **An iPhone app that starts as a new device:** the first time the installed app opens on a device that isn't signed in, a small card says "Sign in with your email to keep your app's 10%" and links to the account page. Signing in (or subscribing) on an installed device marks that email's account as installed, so the 20% also applies when they order in Safari. Older chats and orders stay on the device they were made on, as the account spec says.
  - **Honest offers:** on a device signed into an email that has already used its welcome discount, the card and pop-up still invite installing but drop the discount wording ("Get the app" / "Faster ordering and order updates."; pop-up "Install the app" with the notifications and home-screen ticks only). Not signed in, the store can't know, so the discount wording shows. Promising a discount someone can't get would mislead (Australian Consumer Law).
  - **Testing:** there is no preview host, so the build is verified on a local production build; installing and notifications on a real iPhone and Android are a checklist for the owner after deploying, with the two VAPID settings added on the live host. The builder generates the key pair into `.env.local` without displaying it.

## Left to the builder

Schema details and migration, file and component structure, the service worker's code, icon generation, animation, exact tutorial copy and icons, notification wording, and how the install event is caught early (`instrumentation-client.ts` or a component).
