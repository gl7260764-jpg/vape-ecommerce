// Display names for analytics values. Safe in server and client components.
import type { TrafficChannel, VisitorEventType } from "@/generated/prisma/client";
export { CHANNEL_LABELS } from "@/lib/analytics/source";

export const EVENT_LABELS: Record<VisitorEventType, string> = {
  page_view: "Viewed a page",
  add_to_cart: "Added to cart",
  remove_from_cart: "Removed from cart",
  open_cart: "Opened the cart",
  search: "Searched",
  begin_checkout: "Started checkout",
  place_order: "Placed an order",
  subscribe: "Subscribed",
  install_app: "Installed the app",
  enable_notifications: "Turned on notifications",
};

export const CHANNELS: TrafficChannel[] = ["direct", "organic", "ai", "social", "email", "paid", "referral"];

const regionNames = new Intl.DisplayNames(["en-AU"], { type: "region" });

/** "AU" -> "Australia". Unknown codes fall back to the code itself. */
export function countryName(code: string | null | undefined) {
  if (!code) return null;
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** "Sydney, New South Wales, Australia", trimmed to what we know. */
export function placeLabel(v: { city?: string | null; region?: string | null; country?: string | null }, withCountry = true) {
  const bits = [v.city, v.region !== v.city ? v.region : null, withCountry ? countryName(v.country) : null].filter(Boolean);
  return bits.length ? bits.join(", ") : null;
}

/** Store titles end in " | Best Vape Shop Australia"; the admin only needs the page part. */
export const pageTitle = (title: string | null | undefined) => {
  if (!title) return null;
  if (/^Best Vape Shop Australia\s*\|/i.test(title)) return "Home";
  return title.replace(/\s*\|\s*Best Vape Shop Australia\s*$/i, "").trim() || null;
};

export const DEVICE_LABELS: Record<string, string> = { mobile: "Mobile", tablet: "Tablet", desktop: "Desktop" };
