import { unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { listInbox } from "@/lib/chat/inbox";
import { markAllDelivered } from "@/lib/chat/service";
import { adminAuthResponse, NO_STORE } from "@/lib/chat/staff";

/** The inbox: `?q=` searches name, email or order number; `?unread=1` keeps conversations waiting on the team. */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (error) {
    return adminAuthResponse(error);
  }
  const params = new URL(request.url).searchParams;
  const now = new Date().toISOString(); // for "online" dots, against the server's clock
  try {
    const inbox = await listInbox({ q: params.get("q") ?? undefined, unread: params.get("unread") === "1" });
    // The team's inbox has these messages now: two grey ticks for the customer.
    after(() => markAllDelivered().catch((error) => console.error("chat inbox delivered failed", error)));
    return Response.json({ now, ...inbox }, { headers: NO_STORE });
  } catch (error) {
    unstable_rethrow(error); // framework signals (prerender, redirects) pass through
    console.error("chat inbox failed", error);
    return Response.json({ error: "The inbox couldn't load. Trying again shortly." }, { status: 503, headers: NO_STORE });
  }
}
