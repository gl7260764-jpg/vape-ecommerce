import "server-only";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";
import { Prisma, type VisitorEventType } from "@/generated/prisma/client";
import { SESSION_COOKIE, TRACKING_ID, VISITOR_COOKIE } from "@/lib/analytics/constants";
import { clientIpFrom, locate } from "@/lib/analytics/geo";
import { classifySource, type Utm } from "@/lib/analytics/source";
import { parseUserAgent } from "@/lib/analytics/ua";

export type Hit = {
  visitorId: string;
  sessionId: string;
  type: VisitorEventType;
  path: string;
  /** First page of the visit; defaults to this hit's path. */
  landingPath?: string;
  title?: string | null;
  label?: string | null;
  value?: number | null;
  referrer?: string | null;
  utm?: Utm;
  clickId?: "google" | "meta" | "microsoft" | null;
};

const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/**
 * Stores one hit: upserts the visitor (first-touch fields only on insert), opens or extends
 * the visit, and appends the event. Location and source are worked out once per visit.
 */
export async function recordHit(hit: Hit, request: { headers: Headers; internal: boolean }) {
  const now = new Date();
  const ua = parseUserAgent(request.headers.get("user-agent"));
  const session = await prisma.visitorSession.findUnique({ where: { id: hit.sessionId }, select: { visitorId: true } });
  if (session && session.visitorId !== hit.visitorId) return; // a visit belongs to one browser; ignore mismatches

  const isNewVisit = !session;
  const ip = clientIpFrom(request.headers);
  const geo = isNewVisit ? await locate(request.headers, ip) : null;
  const src = isNewVisit ? classifySource({ referrer: hit.referrer, utm: hit.utm, clickId: hit.clickId, selfHost: request.headers.get("host")?.split(":")[0] }) : null;
  const isView = hit.type === "page_view";
  const context = isNewVisit ? { ip, ...geo!, device: ua.device, browser: ua.browser, os: ua.os } : {};

  const upsertVisitor = () =>
    prisma.visitor.upsert({
      where: { id: hit.visitorId },
      create: {
        id: hit.visitorId,
        firstSeenAt: now,
        lastSeenAt: now,
        sessionCount: 0, // counted below, once the visit row really exists
        pageviewCount: isView ? 1 : 0,
        firstSource: src?.source ?? "Direct",
        firstChannel: src?.channel ?? "direct",
        firstReferrer: hit.referrer?.slice(0, 500) ?? null,
        firstLanding: hit.landingPath ?? hit.path,
        firstUtmSource: hit.utm?.source ?? null,
        firstUtmMedium: hit.utm?.medium ?? null,
        firstUtmCampaign: hit.utm?.campaign ?? null,
        ...context,
        isBot: ua.isBot,
        isInternal: request.internal,
      },
      update: {
        lastSeenAt: now,
        ...(isView ? { pageviewCount: { increment: 1 } } : {}),
        ...context,
        ...(ua.isBot ? { isBot: true } : {}),
        ...(request.internal ? { isInternal: true } : {}),
      },
    });
  // Two hits from a brand-new browser can race to insert; the loser simply updates.
  await upsertVisitor().catch((e) => (isUnique(e) ? upsertVisitor() : Promise.reject(e)));

  const extend = () =>
    prisma.visitorSession.update({
      where: { id: hit.sessionId },
      data: { lastSeenAt: now, eventCount: { increment: 1 }, ...(isView ? { pageviews: { increment: 1 }, exitPath: hit.path } : {}) },
    });
  if (isNewVisit) {
    // Two hits of a brand-new visit can both get here; only the one that creates the row counts the visit.
    const created = await prisma.visitorSession
      .create({
        data: {
          id: hit.sessionId,
          visitorId: hit.visitorId,
          startedAt: now,
          lastSeenAt: now,
          landingPath: hit.landingPath ?? hit.path,
          exitPath: isView ? hit.path : null,
          referrer: hit.referrer?.slice(0, 500) ?? null,
          referrerHost: src!.referrerHost,
          source: src!.source,
          channel: src!.channel,
          utmSource: hit.utm?.source ?? null,
          utmMedium: hit.utm?.medium ?? null,
          utmCampaign: hit.utm?.campaign ?? null,
          ...context,
          pageviews: isView ? 1 : 0,
          eventCount: 1,
        },
        select: { id: true },
      })
      .then(
        () => true,
        (e) => (isUnique(e) ? extend().then(() => false) : Promise.reject(e))
      );
    if (created) await prisma.visitor.update({ where: { id: hit.visitorId }, data: { sessionCount: { increment: 1 } } });
  } else {
    await extend();
  }

  await prisma.visitorEvent.create({
    data: {
      visitorId: hit.visitorId,
      sessionId: hit.sessionId,
      type: hit.type,
      path: hit.path,
      title: hit.title ?? null,
      label: hit.label ?? null,
      value: hit.value ?? null,
      createdAt: now,
    },
  });
}

const isTransient = (e: unknown) => {
  const err = e as { code?: string; message?: string } | null;
  return /ETIMEDOUT|ECONNRESET|ECONNREFUSED|P1001|P1002|P1017|P2024|terminating connection/i.test(`${err?.code ?? ""} ${err?.message ?? ""}`);
};

/** recordHit with one retry when the database connection blips (Neon waking up, a network hiccup). */
export async function recordHitSafely(hit: Hit, request: { headers: Headers; internal: boolean }) {
  for (let attempt = 1; ; attempt++) {
    try {
      await recordHit(hit, request);
      return;
    } catch (error) {
      if (attempt >= 2 || !isTransient(error)) {
        console.error("analytics hit not stored", error);
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

/** The tracking ids the browser sent with this request, if valid. For server actions. */
export async function currentVisit() {
  const jar = await cookies();
  const visitorId = jar.get(VISITOR_COOKIE)?.value;
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  return {
    visitorId: visitorId && TRACKING_ID.test(visitorId) ? visitorId : null,
    sessionId: sessionId && TRACKING_ID.test(sessionId) ? sessionId : null,
  };
}

/** Only link records to a visitor that actually exists (tracking may be blocked). */
export async function existingVisitorId(visitorId: string | null) {
  if (!visitorId) return null;
  const v = await prisma.visitor.findUnique({ where: { id: visitorId }, select: { id: true } });
  return v?.id ?? null;
}

/**
 * Records a server-side event (an order, a signup) against the current visit and attaches
 * the email to the visitor. Safe to call when tracking is blocked: it simply does nothing.
 */
export async function recordServerEvent(input: { visitorId: string | null; sessionId: string | null; type: VisitorEventType; path: string; label?: string; value?: number; email?: string }) {
  if (!input.visitorId || !input.sessionId) return;
  try {
    const visitor = await prisma.visitor.findUnique({ where: { id: input.visitorId }, select: { email: true } });
    if (!visitor) return;
    if (input.email && !visitor.email) {
      await prisma.visitor.update({ where: { id: input.visitorId }, data: { email: input.email, identifiedAt: new Date() } });
    }
    await recordHitSafely(
      { visitorId: input.visitorId, sessionId: input.sessionId, type: input.type, path: input.path, label: input.label, value: input.value },
      { headers: await headers(), internal: false }
    );
  } catch (error) {
    console.error("could not record server event", error);
  }
}
