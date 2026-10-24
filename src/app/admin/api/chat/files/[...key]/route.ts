import { requireAdmin } from "@/lib/admin/auth";
import { CHAT_FILE_KEY, streamChatFile } from "@/lib/chat/files";
import { adminAuthResponse } from "@/lib/chat/staff";

/** Any conversation's file, for signed-in team members only. */
export async function GET(_request: Request, ctx: RouteContext<"/admin/api/chat/files/[...key]">) {
  try {
    await requireAdmin();
  } catch (error) {
    return adminAuthResponse(error);
  }
  const key = (await ctx.params).key.join("/");
  if (!CHAT_FILE_KEY.test(key)) return new Response("Not found", { status: 404 });
  return streamChatFile(key);
}
