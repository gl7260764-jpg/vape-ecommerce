// Which way this device installs the store as an app. Pure and client-safe.

export type AppPlatform = "iphone" | "ipad" | "android" | "mac-safari" | "chromium" | "firefox" | "in-app" | "other";

type Device = { userAgent: string; maxTouchPoints: number };

const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|TikTok|musical_ly|BytedanceWebview/;
// iPadOS Safari asks for desktop sites, so it says "Macintosh"; only the touch screen gives it away.
const isIpad = ({ userAgent, maxTouchPoints }: Device) => /iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);

/**
 * In-app browsers (Instagram, TikTok, Facebook) can't install; every iPhone/iPad browser installs through
 * Share; Android and desktop Chrome, Edge, Samsung Internet and Opera can show their own prompt.
 */
export function appPlatform(device: Device): AppPlatform {
  const ua = device.userAgent;
  if (IN_APP.test(ua)) return "in-app";
  if (/iPhone|iPod/.test(ua)) return "iphone";
  if (isIpad(device)) return "ipad";
  if (/Firefox\/|FxiOS/.test(ua)) return "firefox";
  if (/Android/.test(ua)) return "android";
  if (/Chrome\/|Chromium\/|Edg\/|OPR\//.test(ua)) return "chromium";
  if (/Macintosh/.test(ua) && /Safari\//.test(ua)) return "mac-safari";
  return "other";
}

/** The device by name for the team ("iPhone", "Android", "Mac", "Windows"…). */
export function installPlatformLabel(device: Device): string {
  const ua = device.userAgent;
  if (/iPhone|iPod/.test(ua)) return "iPhone";
  if (isIpad(device)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Macintosh|Mac OS X/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "Other";
}
