# SDD ledger — plan: docs/superpowers/plans/2026-10-24-app-install.md
Spec: docs/superpowers/specs/2026-10-24-app-install-design.md (approved by the owner: "so good let go"; builder-check answers folded in as builder's calls)
Setup: Ruling: work in place on main with no commits, as for the earlier features (the owner hasn't asked for commits) — cost if wrong: no commit range for the reviewer.
Builder check: Ruling: notifications cover team chat replies and order paid/shipped/delivered (the owner didn't say; promotions later) — cost if wrong: an admin broadcast feature still to build.
Builder check: Ruling: an iPhone app that starts without Safari's cookies asks once to sign in; signing in or subscribing on an installed device marks the account installed so the 20% works in Safari too — cost if wrong: one small extra card in the app.
Builder check: Ruling: a device signed into an email whose welcome discount is used sees the install offers without discount wording (honest, Australian Consumer Law) — cost if wrong: a second set of copy.
Builder check: Ruling: verification stops at a local production build; real iPhone/Android install and notification checks are an owner checklist after deploy; VAPID keys generated into .env.local without display — cost if wrong: iPhone-only problems surface after deploy.
Pre-flight:
- T1→T2: welcomeDiscountFor(email, visitorId) → { percent, label } | null consumed by checkout; discountLabel/DISCOUNT_LABEL by order, invoice, admin. Consistent.
- T1→T4: recordAppInstall, markAccountInstalled, appOffersFor consumed by actions and /api/app/status. Consistent.
- T3→T4: useInstall (platform, canPrompt, isApp, prompt) and appPlatform/platformLabel consumed by the offers. Consistent.
- T1→T5: PushSubscription, ChatConversation.lastPushAt consumed by push.ts. Consistent.
- T1/T5→T6: Visitor.appInstalledAt/appPlatform and PushSubscription.visitor relation consumed by the admin queries. Consistent (relation added in Task 1).
Task 1: Ruling: `discountFor` is replaced by `welcomeDiscountFor(email, visitorId)`; checkout passes `null` for the visitor until Task 2 — cost if wrong: none (Task 2 finishes it).
Task 1: complete (no commits; migration 20261024164435_app_install_push applied (additive); tests: npm test → ℹ pass 74 ℹ fail 0 (new: discount 1, newsletter 1, app-install 4; one earlier run had 2 blank Neon errors in newsletter.test, passed on rerun); tsc clean)
Task 2: complete (no commits; tests: npm test → ℹ pass 75 ℹ fail 0 (new: "snapshot carries the discount label"); tsc + eslint clean; the 20% checkout line is checked by Task 4's e2e)
Task 3: Ruling: `appPlatform` takes `{ userAgent, maxTouchPoints }` only (the plan also listed `standalone`; whether the page runs as the app lives in the install store, not the platform) and `platformLabel` is `installPlatformLabel({ userAgent, maxTouchPoints })` — cost if wrong: none.
Task 3: Ruling: manifest `start_url` is "/" (not "/?source=app") so app visits don't read as a new traffic source; theme/background #0d0e12 to match the site's dark theme colour; icons drawn with DejaVu Sans Bold (the site's Archivo isn't a local file) — cost if wrong: icons regenerate with one command.
Task 3: Ruling: the e2e for the shell was written with the implementation (the unit test for platforms went RED→GREEN first); it adds Chrome's own installability check in a normal profile (Playwright's private windows always say "in-incognito") — cost if wrong: none.
Task 3: complete (no commits; tests: npm test → see line below; app-platform.test.ts 2 RED→GREEN; e2e-app pwa → 5/5 incl. Chrome reports no installability errors; tsc + eslint clean; build clean)
Task 3: tests: npm test → ℹ pass 76 ℹ fail 1 (invoice-chat.test.ts: blank Neon error after 26 s, unrelated to Task 3) → that file alone 8/8; suite otherwise 77 incl. app-platform 2
Task 4: Ruling: e2e test owner e2e-admin@example.com recreated for the settings tests; deleted at cleanup — cost if wrong: a test login until then.
Task 4: Ruling: the navbar can't read the page path (the header sits outside Suspense; Next 16 refused to prerender /order/[token]), so the offers controller publishes "quiet page" into the install store — cost if wrong: none.
Task 4: Ruling: the bottom card waits for /api/app/status before showing, so a used discount is never promised even for a moment (the e2e caught the flash) — cost if wrong: the card appears a fraction of a second later.
Task 4: Ruling: fixed a race the e2e exposed — an install recorded before the app's first page view stored its visitor was lost but remembered as done; `recordAppInstall` now returns whether it landed and the app retries (5 × 3 s, and on later loads) — test "an install that arrives before the visitor exists is not counted as recorded" RED→GREEN — cost if wrong: a few extra requests.
Task 4: Ruling: while the install icon shows on phones under 420 px, the logo shows only its "B" mark so the cart stays on screen — cost if wrong: the brand name hidden on small phones until the app is installed or the offers are off.
Task 4: progress (not complete): e2e-app offers → 19/19; app-install.test.ts 5/5; tsc + eslint clean; build clean. Left for Task 4: full npm test run and screenshot review. PAUSED 2026-10-24 at the owner's request to do the checkout auto-fill first.
Task 4: Ruling: the scratchpad (e2e scripts, Playwright) was wiped by a second session restart; e2e-app.mjs was rebuilt from this session's record and re-run — cost if wrong: none (same checks).
Task 4: complete (no commits; tests: npm test → ℹ pass 78 ℹ fail 0; e2e-app all → 23/23 (shell 5, offers 17, no errors); tsc + eslint clean; build clean; screenshots: card desktop/phone, install pop-up, iPhone steps dark/light checked against the mockup)
Task 5: Ruling: added `web-push@3.6.7` and `@types/web-push@3.6.4` (the library the Next.js guide uses); VAPID keys generated into .env.local (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY) without being displayed; VAPID_SUBJECT defaults to the store's URL — cost if wrong: keys must be copied to the live host.
Task 5: Ruling: `changeOrderStatus` now returns whether the status changed, so re-saving the same status doesn't notify twice — cost if wrong: none.
Task 5: Ruling: notifications are sent from the server actions with `after()` (staff message saved; status changed to paid/shipped/delivered), so the team's save never waits on push services — cost if wrong: none.
Task 5: Ruling: headless Chrome has no push service, so subscribing and delivery can't be exercised here; the e2e checks the offers (account card, hidden without support, once in the app) and the unit tests cover sending, pruning, throttling and who gets what; real-device checks join the owner's checklist — cost if wrong: a delivery problem shows up only on real phones.
Task 5: complete (no commits; tests: npm test → ℹ pass 81 ℹ fail 0 (new: push.test.ts 3 RED→GREEN); e2e-app push → 4/4; tsc + eslint clean; build clean)
Task 6: complete (no commits; tests: e2e-app visitors → 3/3 RED→GREEN (list 'App · Windows', visitor page App row + 'Installed the app' event); tsc + eslint clean; build clean)
Task 7: Ruling: the account e2e suite (lost with the scratchpad) was not rebuilt; the app suite signs in, subscribes, orders and opens the account page, which covers the account code this plan touched — cost if wrong: an account-only regression goes unseen until the next account test run.
Task 7: complete (no commits; tests: npm test → ℹ pass 81 ℹ fail 0; npx eslint . → clean; tsc clean; build clean; e2e-app all → 28/28 (shell 5, offers 17, push 3, visitors 2, no errors); ADMIN-BLUEPRINT Progress recorded)
Final review: fable reviewer — 1 Critical, 3 Important, 9 Minor; rulings upheld except the Task 4 race fix (incomplete: a missing visitor cookie counted as recorded) and two it questioned (notify from actions leaves invoice posts out; the wordmark rule reaches most iPhones).
Final: fixed (Critical) a brand-new iPhone app's install was counted as recorded before its analytics cookie existed, so it never got the app 10% — `recordAppInstall` returns false with no visitor (unless the account was marked) and the app retries — test "an install with no visitor cookie yet is not counted as recorded" RED→GREEN; e2e "a brand-new app records its install on its first load" added as a guard (the race is timing-dependent and didn't trigger in the RED run).
Final: fixed (Important) the iPhone app's status bar covered the navbar — statusBarStyle "black" — e2e "the iPhone app keeps the status bar off the navbar" RED→GREEN.
Final: fixed (Important) sign-out left notifications bound to the old account on shared devices — `forgetDevice(tokenHash)` deletes the device's push subscriptions with its orders, and Sign out unsubscribes the browser first — test "signing out forgets the device's notifications too" RED→GREEN.
Final: fixed (Important) installed shoppers kept getting install offers in their browser — `appOffersFor(tokenHash, visitorId)` returns `installed` (this browser's visitor, or the account) and the card, pop-up and navbar icon stop — test "offers stop once the app is installed, on this browser or by the account" RED→GREEN; e2e "no install offers once the app is installed" added.
Final: fix pass suite: npm test 87/87; e2e-app all 31/31; eslint . clean; tsc clean; build clean.
Final: minor (deferred): a corrected invoice sent to the chat doesn't trigger a notification (only typed team replies do).
Final: minor (deferred): push failures other than 404/410 aren't logged, so wrong VAPID keys on the live host would fail silently.
Final: minor (deferred): "Turn on notifications" can hang with no feedback if the service worker never registered (dev, or a failed registration).
Final: minor (deferred): inside the app, the notifications card can flash before the one-time sign-in card replaces it.
Final: minor (deferred): /api/app/status is fetched on every page load even when the offers are switched off (1-2 small queries per visit); a failed fetch hides the card for that page.
Final: minor (deferred): the steps note "Firefox on computers can't install apps" also shows on Firefox for Android.
Final: minor (deferred): tapping a notification does nothing if the store window isn't controlled by the service worker (rare: activate claims open windows); a fallback to opening a new window would cover it.
Final: minor (deferred): while the install icon shows, the "BEST VAPE" wordmark is hidden on phones under 420 px, i.e. most iPhones (it only has to hide when the message icon also shows); the swap happens after the page loads.
Final: minor (deferred): offline.html is only refreshed when sw.js changes; bump the cache name when editing it.
Final: Ruling: admin-sent promotional notifications — spec non-goal, stands — cost if wrong: a broadcast feature to build later.
Final: Ruling: offline browsing beyond the offline page — spec non-goal, stands — cost if wrong: none.
Final: Ruling: anyone can claim "installed" — accepted by the spec (same one-time 10% they'd get by installing) — cost if wrong: some 10%s given without an install.
Final: Ruling: Firefox on computers can't install — browser limitation, the steps say so — cost if wrong: none.
Final: Ruling: real-device install and push delivery untested here — environment limit; owner checklist — cost if wrong: iPhone-only problems found after deploy.
Final: Ruling: VAPID keys and VAPID_SUBJECT on the live host — deployment step for the owner — cost if wrong: no notifications until set.
Final: Ruling: account e2e suite not rebuilt — accepted with its stated risk — cost if wrong: an account-only regression unseen.
Final: Ruling: start_url "/" — fine, the Visitors App tag covers attribution — cost if wrong: none.
Final: Ruling: enableNotifications has no rate limit — rows are bounded by the unique endpoint — cost if wrong: junk rows a spammer would have to work for.
Final: cleanup done: 6 test orders, 57 chats, 45 customers, 36 subscribers, 6 redemptions, 43 test visitors (@example.com, or marked installed by the e2e with no real email), 24 login attempts, the e2e admin removed; kept the owner's 5 orders, 2 chats, 4 customers, 1 admin; pop-up settings at the defaults (on, 8 s, 10 s, until they subscribe, install offers on).
