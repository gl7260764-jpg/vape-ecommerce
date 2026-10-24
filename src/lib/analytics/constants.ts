// Shared by the browser tracker and the server.
export const VISITOR_COOKIE = "bvsa_vid"; // one browser, 400 days
export const SESSION_COOKIE = "bvsa_sid"; // one visit, renewed after 30 minutes idle
export const STAFF_COOKIE = "bvsa_staff"; // set at admin sign-in: this browser's visits are the team's own

export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const TRACKING_ID = /^[A-Za-z0-9_-]{16,64}$/;

/** Events the browser may send. Orders and signups are recorded by the server itself. */
export const CLIENT_EVENTS = ["page_view", "add_to_cart", "remove_from_cart", "open_cart", "search", "begin_checkout"] as const;
export type ClientEvent = (typeof CLIENT_EVENTS)[number];
