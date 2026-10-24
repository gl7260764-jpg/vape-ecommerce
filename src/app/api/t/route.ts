import { after } from "next/server";
import { z } from "zod";
import { CLIENT_EVENTS, STAFF_COOKIE, TRACKING_ID } from "@/lib/analytics/constants";
import { recordHitSafely } from "@/lib/analytics/record";

const text = (max: number) => z.string().trim().max(max).optional();

const hitSchema = z.object({
  v: z.string().regex(TRACKING_ID),
  s: z.string().regex(TRACKING_ID),
  t: z.enum(CLIENT_EVENTS),
  p: z.string().startsWith("/").max(500),
  lp: z.string().startsWith("/").max(500).optional(), // the visit's landing page
  ti: text(200),
  l: text(200),
  val: z.number().int().min(0).max(100_000_000).optional(),
  r: z.string().max(1000).optional(),
  u: z.object({ s: text(100), m: text(100), c: text(150) }).optional(),
  ck: z.enum(["google", "meta", "microsoft"]).optional(),
});

/**
 * Analytics beacon from the storefront. Answers 204 straight away and stores the hit
 * after the response, so tracking never slows a page down. Bad input is dropped silently.
 */
export async function POST(request: Request) {
  const body = await request.text();
  if (body.length > 4000) return new Response(null, { status: 413 });

  let parsed: z.infer<typeof hitSchema>;
  try {
    const result = hitSchema.safeParse(JSON.parse(body));
    if (!result.success) return new Response(null, { status: 204 });
    parsed = result.data;
  } catch {
    return new Response(null, { status: 204 });
  }
  if (parsed.p.startsWith("/admin")) return new Response(null, { status: 204 });
  // Each order confirmation has a private token in its address; don't store it, and count them as one page.
  const privatePath = (p: string) => p.replace(/^\/order\/[^/?#]+/, "/order/confirmation");
  const path = privatePath(parsed.p);

  const headers = new Headers(request.headers);
  const internal = new RegExp(`(?:^|;\\s*)${STAFF_COOKIE}=1(?:;|$)`).test(headers.get("cookie") ?? "");

  after(() =>
    recordHitSafely(
      {
        visitorId: parsed.v,
        sessionId: parsed.s,
        type: parsed.t,
        path,
        landingPath: parsed.lp ? privatePath(parsed.lp) : path,
        title: parsed.ti || null,
        label: parsed.l || null,
        value: parsed.val ?? null,
        referrer: parsed.r || null,
        utm: parsed.u ? { source: parsed.u.s || null, medium: parsed.u.m || null, campaign: parsed.u.c || null } : undefined,
        clickId: parsed.ck ?? null,
      },
      { headers, internal }
    )
  );
  return new Response(null, { status: 204 });
}
