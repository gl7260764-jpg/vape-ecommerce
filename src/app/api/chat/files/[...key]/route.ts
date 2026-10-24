import { customerActor } from "@/lib/chat/access";
import { streamChatFile } from "@/lib/chat/files";

/** A file from this device's own conversation; anything else is a plain 404. */
export async function GET(_request: Request, ctx: RouteContext<"/api/chat/files/[...key]">) {
  const actor = await customerActor();
  const key = (await ctx.params).key.join("/");
  if (!actor || !key.startsWith(`chat/${actor.conversationId}/`)) return new Response("Not found", { status: 404 });
  return streamChatFile(key);
}
