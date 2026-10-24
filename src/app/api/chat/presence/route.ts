import { unstable_rethrow } from "next/navigation";
import { customerActor } from "@/lib/chat/access";
import { customerHeartbeat, customerLeft } from "@/lib/chat/presence";

/** Heartbeats from open store tabs (every 25 s) and a "leave" beacon when the last one closes. Best effort. */
export async function POST(request: Request) {
  try {
    return await beat(request);
  } catch (error) {
    unstable_rethrow(error); // framework signals (prerender, redirects) pass through
    console.error("customer presence failed", error);
    return new Response(null, { status: 503 });
  }
}

async function beat(request: Request) {
  const actor = await customerActor();
  if (!actor) return new Response(null, { status: 404 });
  let state: unknown;
  try {
    state = (JSON.parse(await request.text()) as { state?: unknown }).state;
  } catch {
    return new Response(null, { status: 400 });
  }
  if (state === "beat") await customerHeartbeat(actor.conversationId);
  else if (state === "leave") await customerLeft(actor.conversationId);
  else return new Response(null, { status: 400 });
  return new Response(null, { status: 204 });
}
