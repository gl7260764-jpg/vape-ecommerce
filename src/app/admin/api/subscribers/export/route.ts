import { AdminAuthError, requireAdmin } from "@/lib/admin/auth";
import { ordersByEmail, parseSubscriberParams, subscriberSelect, subscriberWhere } from "@/lib/admin/queries/subscribers";
import { countryName } from "@/lib/analytics/labels";
import { CHANNEL_LABELS } from "@/lib/analytics/source";
import { prisma } from "@/lib/db";

const COLUMNS = ["Email", "Joined", "Signed up via", "Country", "State or region", "City", "Came from", "Channel", "Orders", "Order total (AUD)"];

/** Quotes fields that need it and defuses spreadsheet formulas (=, +, -, @). */
function cell(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV of the subscribers matching the current filters (same params as the page). Owner only. */
export async function GET(request: Request) {
  try {
    await requireAdmin("people:manage");
  } catch (error) {
    if (error instanceof AdminAuthError) return new Response(error.code === "FORBIDDEN" ? "Only the owner can export subscribers." : "Sign in to continue.", { status: error.code === "FORBIDDEN" ? 403 : 401 });
    throw error;
  }

  const params = parseSubscriberParams(Object.fromEntries(new URL(request.url).searchParams));
  const where = await subscriberWhere(params);
  const encoder = new TextEncoder();
  const BATCH = 500;

  // Streamed in batches so a long list never sits in memory all at once.
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`﻿${COLUMNS.join(",")}\r\n`));
      let cursor: string | undefined;
      for (;;) {
        const rows = await prisma.subscriber.findMany({
          where,
          orderBy: { id: "asc" },
          take: BATCH,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          select: subscriberSelect,
        });
        if (!rows.length) break;
        const orders = await ordersByEmail(rows.map((r) => r.email));
        const lines = rows.map((r) => {
          const o = orders.get(r.email.toLowerCase());
          const v = r.visitor;
          return [
            r.email,
            r.createdAt.toISOString(),
            r.source ?? "",
            countryName(v?.country) ?? "",
            v?.region ?? "",
            v?.city ?? "",
            v?.firstSource ?? "",
            v?.firstChannel ? CHANNEL_LABELS[v.firstChannel] : "",
            o?.orders ?? 0,
            ((o?.totalCents ?? 0) / 100).toFixed(2),
          ]
            .map(cell)
            .join(",");
        });
        controller.enqueue(encoder.encode(lines.join("\r\n") + "\r\n"));
        cursor = rows.at(-1)!.id;
        if (rows.length < BATCH) break;
      }
      controller.close();
    },
  });

  const date = new Date().toISOString().slice(0, 10);
  const suffix = params.view !== "all" ? `-${params.view}` : "";
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="subscribers${suffix}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
