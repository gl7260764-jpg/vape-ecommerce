import { unstable_rethrow } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { conversationContext, getConversation } from "@/lib/chat/inbox";
import { ChatError, listMessages, markReceipts, syncFrom } from "@/lib/chat/service";
import { adminAuthResponse, NO_STORE, staffActorFor } from "@/lib/chat/staff";

/**
 * One conversation for the team. No params: the newest 200 messages plus the customer's orders and
 * visitor. `changedSince=`: only what changed (10 s of overlap). `before=`: 50 older.
 * Fetching it delivers the customer's messages to the team (two grey ticks); reading is separate.
 */
export async function GET(request: Request, ctx: RouteContext<"/admin/api/chat/[id]">) {
  let actor;
  try {
    actor = staffActorFor(await requireAdmin());
  } catch (error) {
    return adminAuthResponse(error);
  }
  const { id } = await ctx.params;
  const params = new URL(request.url).searchParams;
  const changedSince = params.get("changedSince");
  const before = params.get("before");
  const now = new Date().toISOString(); // taken before reading, so the next sync starts from here
  try {
    const conversation = await getConversation(id);
    if (!conversation) return Response.json({ error: "No such chat." }, { status: 404, headers: NO_STORE });
    await markReceipts(actor, { conversationId: id, kind: "delivered", upTo: now });
    const [messages, context] = await Promise.all([
      listMessages(id, actor, {
        changedSince: changedSince ? syncFrom(changedSince) : undefined,
        before: before ?? undefined,
      }),
      changedSince || before ? null : conversationContext(id),
    ]);
    return Response.json({ now, conversation, messages, ...context }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ChatError && error.code === "INVALID") return Response.json({ error: "Bad request." }, { status: 400, headers: NO_STORE });
    if (error instanceof ChatError && error.code === "NOT_FOUND") return Response.json({ error: "No such chat." }, { status: 404, headers: NO_STORE });
    unstable_rethrow(error); // framework signals (prerender, redirects) pass through
    console.error("chat thread failed", error);
    return Response.json({ error: "The chat couldn't load. Trying again shortly." }, { status: 503, headers: NO_STORE });
  }
}
