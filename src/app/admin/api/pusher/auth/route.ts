import { requireAdmin } from "@/lib/admin/auth";
import { channels, CONVERSATION_CHANNEL } from "@/lib/chat/channels";
import { getPusherServer } from "@/lib/chat/realtime";
import { adminAuthResponse } from "@/lib/chat/staff";
import { prisma } from "@/lib/db";

/** Signs a team member's Pusher subscriptions: the admin inbox, and any conversation that exists. */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (error) {
    return adminAuthResponse(error);
  }
  const pusher = getPusherServer();
  if (!pusher) return Response.json({ error: "Live updates aren't set up." }, { status: 503 });
  const form = new URLSearchParams(await request.text());
  const socketId = form.get("socket_id") ?? "";
  const channel = form.get("channel_name") ?? "";
  if (!/^\d+\.\d+$/.test(socketId)) return Response.json({ error: "Not allowed." }, { status: 403 });
  const conversationId = CONVERSATION_CHANNEL.exec(channel)?.[1];
  const allowed = channel === channels.inbox || (conversationId !== undefined && (await prisma.chatConversation.count({ where: { id: conversationId } })) > 0);
  if (!allowed) return Response.json({ error: "Not allowed." }, { status: 403 });
  return Response.json(pusher.authorizeChannel(socketId, channel));
}
