// Browser side of analytics: stable ids and a fire-and-forget beacon. Never throws.
import { SESSION_COOKIE, SESSION_IDLE_MS, TRACKING_ID, VISITOR_COOKIE, type ClientEvent } from "@/lib/analytics/constants";

const LAST_ACTIVE = "bvsa_last";
const ATTRIBUTION = "bvsa_attr"; // how the current visit began, re-sent with every hit of the visit
let firstHitOfPageLoad = true;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

const readCookie = (name: string) => document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))?.[1] ?? null;

function writeCookie(name: string, value: string, maxAgeSeconds?: number) {
  const secure = location.protocol === "https:" ? "; secure" : "";
  const age = maxAgeSeconds ? `; max-age=${maxAgeSeconds}` : "";
  document.cookie = `${name}=${value}; path=/; samesite=lax${age}${secure}`;
}

/** Visitor id lives for 400 days; the visit id rolls over after 30 idle minutes (shared across tabs). */
function ids() {
  let visitor = localStorage.getItem(VISITOR_COOKIE) ?? readCookie(VISITOR_COOKIE);
  if (!visitor || !TRACKING_ID.test(visitor)) visitor = newId();
  localStorage.setItem(VISITOR_COOKIE, visitor);
  writeCookie(VISITOR_COOKIE, visitor, 400 * 86_400);

  const now = Date.now();
  let session = localStorage.getItem(SESSION_COOKIE);
  const lastActive = Number(localStorage.getItem(LAST_ACTIVE) ?? 0);
  const isNewVisit = !session || !TRACKING_ID.test(session) || now - lastActive > SESSION_IDLE_MS;
  if (isNewVisit) session = newId();
  localStorage.setItem(SESSION_COOKIE, session!);
  localStorage.setItem(LAST_ACTIVE, String(now));
  writeCookie(SESSION_COOKIE, session!);
  return { visitor, session: session!, isNewVisit };
}

const TRACKING_PARAMS = /^(utm_\w+|gclid|gbraid|wbraid|msclkid|fbclid|ttclid|twclid|igshid|_ga|mc_cid|mc_eid)$/i;

/** The current path with tracking tags removed, so /?utm_source=x and / count as the same page. */
function cleanPath() {
  const q = new URLSearchParams(location.search);
  for (const key of [...q.keys()]) if (TRACKING_PARAMS.test(key)) q.delete(key);
  const qs = q.toString();
  return (location.pathname + (qs ? `?${qs}` : "")).slice(0, 500);
}

/** Records something a shopper did. `value` is in cents. */
export function track(type: ClientEvent, extra: { label?: string; value?: number } = {}) {
  try {
    if (typeof window === "undefined" || location.pathname.startsWith("/admin")) return;
    const { visitor, session, isNewVisit } = ids();
    const body: Record<string, unknown> = {
      v: visitor,
      s: session,
      t: type,
      p: cleanPath(),
      ti: document.title.slice(0, 200),
    };
    if (extra.label) body.l = extra.label.slice(0, 200);
    if (extra.value !== undefined) body.val = Math.max(0, Math.round(extra.value));

    // How this visit began. Hits are stored in parallel on the server, so a later hit can
    // arrive first; sending the visit's source and landing page with every hit means
    // whichever hit opens the visit records them correctly.
    let attribution: Record<string, unknown> = {};
    if (isNewVisit) {
      const q = new URLSearchParams(location.search);
      const utm = { s: q.get("utm_source") ?? undefined, m: q.get("utm_medium") ?? undefined, c: q.get("utm_campaign") ?? undefined };
      const click = q.has("gclid") || q.has("gbraid") || q.has("wbraid") ? "google" : q.has("msclkid") ? "microsoft" : q.has("fbclid") ? "meta" : null;
      attribution = {
        lp: body.p,
        // The referrer only describes how this page load began, so it only counts on its first hit.
        ...(firstHitOfPageLoad && document.referrer ? { r: document.referrer.slice(0, 1000) } : {}),
        ...(utm.s || utm.m || utm.c ? { u: utm } : {}),
        ...(click ? { ck: click } : {}),
      };
      localStorage.setItem(ATTRIBUTION, JSON.stringify(attribution));
    } else {
      try {
        attribution = JSON.parse(localStorage.getItem(ATTRIBUTION) ?? "{}");
      } catch {
        attribution = {};
      }
    }
    Object.assign(body, attribution);
    firstHitOfPageLoad = false;

    const json = JSON.stringify(body);
    const sent = navigator.sendBeacon?.("/api/t", new Blob([json], { type: "application/json" }));
    if (!sent) fetch("/api/t", { method: "POST", body: json, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
  } catch {
    // Analytics must never break the store (private mode, blocked storage, old browsers).
  }
}
