import assert from "node:assert/strict";
import { test } from "node:test";
import { appPlatform, installPlatformLabel } from "./app-platform";

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1",
  // iPadOS Safari asks for the desktop site: a Mac user agent, but a touch screen.
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  chromeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  chromeMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  android: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
  samsung: "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36",
  firefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0",
  instagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 380.0.0.0",
  tiktok: "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36 musical_ly_2024",
  facebook: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0]",
};
const p = (userAgent: string, maxTouchPoints = 0) => appPlatform({ userAgent, maxTouchPoints });

test("each device gets the right way to install", () => {
  assert.equal(p(UA.iphone, 5), "iphone");
  assert.equal(p(UA.iphoneChrome, 5), "iphone", "every iPhone browser installs through Share");
  assert.equal(p(UA.ipad, 5), "ipad");
  assert.equal(p(UA.macSafari), "mac-safari");
  assert.equal(p(UA.chromeWin), "chromium");
  assert.equal(p(UA.chromeMac), "chromium");
  assert.equal(p(UA.android, 5), "android");
  assert.equal(p(UA.samsung, 5), "android");
  assert.equal(p(UA.firefox), "firefox");
  for (const ua of [UA.instagram, UA.tiktok, UA.facebook]) assert.equal(p(ua, 5), "in-app");
});

test("the team sees the device by name", () => {
  const label = (userAgent: string, maxTouchPoints = 0) => installPlatformLabel({ userAgent, maxTouchPoints });
  assert.equal(label(UA.iphone, 5), "iPhone");
  assert.equal(label(UA.ipad, 5), "iPad");
  assert.equal(label(UA.android, 5), "Android");
  assert.equal(label(UA.macSafari), "Mac");
  assert.equal(label(UA.chromeMac), "Mac");
  assert.equal(label(UA.chromeWin), "Windows");
});
