// A small user-agent reader: enough for device, browser, OS and bot checks, stored at write time.

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|facebookexternalhit|embedly|preview|python-requests|curl|wget|axios|node-fetch|go-http|java\/|phantom|puppeteer|playwright|selenium/i;

export type UaInfo = { device: "mobile" | "tablet" | "desktop"; browser: string; os: string; isBot: boolean };

export function parseUserAgent(ua: string | null | undefined): UaInfo {
  const s = ua ?? "";
  const isBot = !s || BOT.test(s);

  const os = /iPhone|iPod/.test(s)
    ? "iOS"
    : /iPad/.test(s) || (/Macintosh/.test(s) && /Mobile\//.test(s))
      ? "iPadOS"
      : /Android/.test(s)
        ? "Android"
        : /Windows/.test(s)
          ? "Windows"
          : /CrOS/.test(s)
            ? "ChromeOS"
            : /Mac OS X|Macintosh/.test(s)
              ? "macOS"
              : /Linux/.test(s)
                ? "Linux"
                : "Other";

  // In-app browsers first, then the engines that pretend to be each other, most specific first.
  const browser = /FBAN|FBAV|FB_IAB/.test(s)
    ? "Facebook app"
    : /Instagram/.test(s)
      ? "Instagram app"
      : /TikTok|musical_ly|BytedanceWebview/.test(s)
        ? "TikTok app"
        : /SamsungBrowser/.test(s)
          ? "Samsung Internet"
          : /Edg(e|A|iOS)?\//.test(s)
            ? "Edge"
            : /OPR\/|Opera/.test(s)
              ? "Opera"
              : /Firefox|FxiOS/.test(s)
                ? "Firefox"
                : /Chrome|CriOS/.test(s)
                  ? "Chrome"
                  : /Safari/.test(s)
                    ? "Safari"
                    : "Other";

  const device = /iPad|Tablet/.test(s) || (/Android/.test(s) && !/Mobile/.test(s)) || os === "iPadOS" ? "tablet" : /Mobi|iPhone|iPod|Android/.test(s) ? "mobile" : "desktop";
  return { device, browser, os, isBot };
}
