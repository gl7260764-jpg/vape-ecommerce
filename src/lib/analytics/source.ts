// Where a visit came from: one readable source name plus a channel, decided at write time.
import type { TrafficChannel } from "@/generated/prisma/client";

type Classified = { source: string; channel: TrafficChannel };
type Rule = Classified & { match: RegExp };

// Order matters: AI assistants on Google/Microsoft domains must match before plain search.
const HOST_RULES: Rule[] = [
  { match: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$|(^|\.)openai\.com$/, source: "ChatGPT", channel: "ai" },
  { match: /(^|\.)perplexity\.ai$/, source: "Perplexity", channel: "ai" },
  { match: /(^|\.)claude\.ai$/, source: "Claude", channel: "ai" },
  { match: /^gemini\.google\.com$|^bard\.google\.com$/, source: "Gemini", channel: "ai" },
  { match: /^copilot\.microsoft\.com$|(^|\.)copilot\.com$/, source: "Copilot", channel: "ai" },
  { match: /(^|\.)deepseek\.com$/, source: "DeepSeek", channel: "ai" },
  { match: /(^|\.)grok\.com$/, source: "Grok", channel: "ai" },
  { match: /(^|\.)you\.com$|(^|\.)phind\.com$|(^|\.)poe\.com$|(^|\.)meta\.ai$/, source: "AI assistant", channel: "ai" },
  { match: /^mail\.google\.com$|(^|\.)outlook\.(live|office)\.com$|^mail\.yahoo\.com$/, source: "Email", channel: "email" },
  { match: /(^|\.)google\.[a-z.]+$/, source: "Google", channel: "organic" },
  { match: /(^|\.)bing\.com$/, source: "Bing", channel: "organic" },
  { match: /(^|\.)duckduckgo\.com$/, source: "DuckDuckGo", channel: "organic" },
  { match: /(^|\.)yahoo\.[a-z.]+$/, source: "Yahoo", channel: "organic" },
  { match: /(^|\.)ecosia\.org$/, source: "Ecosia", channel: "organic" },
  { match: /^search\.brave\.com$/, source: "Brave Search", channel: "organic" },
  { match: /(^|\.)baidu\.com$/, source: "Baidu", channel: "organic" },
  { match: /(^|\.)yandex\.[a-z.]+$/, source: "Yandex", channel: "organic" },
  { match: /(^|\.)facebook\.com$|^fb\.me$/, source: "Facebook", channel: "social" },
  { match: /(^|\.)instagram\.com$/, source: "Instagram", channel: "social" },
  { match: /(^|\.)tiktok\.com$/, source: "TikTok", channel: "social" },
  { match: /^t\.co$|(^|\.)x\.com$|(^|\.)twitter\.com$/, source: "X (Twitter)", channel: "social" },
  { match: /(^|\.)reddit\.com$/, source: "Reddit", channel: "social" },
  { match: /(^|\.)youtube\.com$|^youtu\.be$/, source: "YouTube", channel: "social" },
  { match: /(^|\.)linkedin\.com$|^lnkd\.in$/, source: "LinkedIn", channel: "social" },
  { match: /(^|\.)pinterest\.[a-z.]+$/, source: "Pinterest", channel: "social" },
  { match: /(^|\.)snapchat\.com$/, source: "Snapchat", channel: "social" },
  { match: /(^|\.)whatsapp\.com$|^wa\.me$/, source: "WhatsApp", channel: "social" },
  { match: /(^|\.)telegram\.org$|^t\.me$/, source: "Telegram", channel: "social" },
  { match: /(^|\.)threads\.net$/, source: "Threads", channel: "social" },
  { match: /(^|\.)discord\.com$/, source: "Discord", channel: "social" },
];

const PAID_MEDIUMS = /^(cpc|ppc|paid|paidsearch|paid_search|paidsocial|paid_social|display|cpm|ads?)$/i;

export type Utm = { source?: string | null; medium?: string | null; campaign?: string | null };

export const hostOf = (url: string | null | undefined) => {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase() || null;
  } catch {
    return null;
  }
};

const ruleFor = (host: string) => HOST_RULES.find((r) => r.match.test(host));

/** Short utm_source values people actually use, beyond full domain names. */
const UTM_NAMES: Record<string, Classified> = {
  google: { source: "Google", channel: "organic" },
  facebook: { source: "Facebook", channel: "social" },
  fb: { source: "Facebook", channel: "social" },
  instagram: { source: "Instagram", channel: "social" },
  ig: { source: "Instagram", channel: "social" },
  tiktok: { source: "TikTok", channel: "social" },
  chatgpt: { source: "ChatGPT", channel: "ai" },
  perplexity: { source: "Perplexity", channel: "ai" },
};

/** utm_source=chatgpt.com -> ChatGPT; utm_source=newsletter -> Newsletter. */
function sourceFromUtm(value: string): Classified {
  const key = value.toLowerCase().trim().replace(/^www\./, "");
  const known = ruleFor(key) ?? UTM_NAMES[key];
  if (known) return { source: known.source, channel: known.channel };
  const pretty = value.trim().slice(0, 60);
  return { source: pretty.charAt(0).toUpperCase() + pretty.slice(1), channel: "referral" };
}

/**
 * Classifies a visit. UTM tags win over the referrer (they're deliberate), ad click ids mark paid,
 * a referrer from this site counts as direct, and no referrer at all is direct.
 */
export function classifySource(input: { referrer?: string | null; utm?: Utm; clickId?: "google" | "meta" | "microsoft" | null; selfHost?: string | null }): {
  source: string;
  channel: TrafficChannel;
  referrerHost: string | null;
} {
  const host = hostOf(input.referrer);
  const referrerHost = host && host !== input.selfHost?.replace(/^www\./, "") ? host : null;
  const medium = input.utm?.medium?.toLowerCase() ?? "";

  if (input.clickId === "google") return { source: "Google Ads", channel: "paid", referrerHost };
  if (input.clickId === "microsoft") return { source: "Microsoft Ads", channel: "paid", referrerHost };

  if (input.utm?.source) {
    const rule = sourceFromUtm(input.utm.source);
    const channel: TrafficChannel = PAID_MEDIUMS.test(medium) ? "paid" : medium === "email" || medium === "newsletter" ? "email" : medium === "social" ? "social" : rule.channel;
    return { source: rule.source, channel, referrerHost };
  }

  if (!referrerHost) return { source: "Direct", channel: "direct", referrerHost: null };
  const rule = ruleFor(referrerHost);
  if (rule) return { source: rule.source, channel: rule.channel, referrerHost };
  return { source: referrerHost, channel: "referral", referrerHost };
}

export const CHANNEL_LABELS: Record<TrafficChannel, string> = {
  direct: "Direct",
  organic: "Search engines",
  ai: "AI assistants",
  social: "Social media",
  email: "Email",
  paid: "Paid ads",
  referral: "Other websites",
};
