import { customerActor } from "@/lib/chat/access";
import { channels } from "@/lib/chat/channels";
import { getPusherServer } from "@/lib/chat/realtime";

/** Signs a customer's Pusher subscription, only ever for their own conversation's channel. */
export async function POST(request: Request) {
  const pusher = getPusherServer();
  if (!pusher) return Response.json({ error: "Live updates aren't set up." }, { status: 503 });
  const actor = await customerActor();
  const form = new URLSearchParams(await request.text());
  const socketId = form.get("socket_id") ?? "";
  const channel = form.get("channel_name") ?? "";
  if (!actor || !/^\d+\.\d+$/.test(socketId) || channel !== channels.conversation(actor.conversationId)) {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }
  return Response.json(pusher.authorizeChannel(socketId, channel));
}
