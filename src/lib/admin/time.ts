// Calendar maths in the store's own time zone. "Today" means today in Sydney, wherever the server runs.
export const STORE_TZ = "Australia/Sydney";

const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: STORE_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Milliseconds Sydney is ahead of UTC at a given instant (DST-aware). */
function offsetMs(at: Date) {
  const p = Object.fromEntries(parts.formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - at.getTime()) / 60_000) * 60_000;
}

/** The instant Sydney's day began, `daysAgo` days back (0 = today). */
export function storeDayStart(daysAgo = 0, from = new Date()) {
  const local = new Date(from.getTime() + offsetMs(from));
  local.setUTCHours(0, 0, 0, 0);
  local.setUTCDate(local.getUTCDate() - daysAgo);
  const guess = local.getTime() - offsetMs(new Date(local.getTime() - offsetMs(from)));
  return new Date(guess);
}

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TZ, hourCycle: "h23", hour: "2-digit" });

/** "2026-10-23" in Sydney time. Matches SQL to_char(..., 'YYYY-MM-DD'). */
export const dayKey = (d: Date) => dayFmt.format(d);
/** "2026-10-23 14" in Sydney time. Matches SQL to_char(..., 'YYYY-MM-DD HH24'). */
export const hourKey = (d: Date) => `${dayFmt.format(d)} ${hourFmt.format(d).padStart(2, "0")}`;

/** "3 min ago", "5 h ago", "2 d ago", then a date. */
export function timeAgo(d: Date, now = new Date()) {
  const s = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  if (s < 7 * 86_400) return `${Math.round(s / 86_400)} d ago`;
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: STORE_TZ }).format(d);
}

/** "2 min 05 s", "1 h 12 min". */
export function formatDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
  return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
}
