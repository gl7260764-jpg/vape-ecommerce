import { unstable_rethrow } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { staffHeartbeat, staffLeft } from "@/lib/chat/presence";
import { adminAuthResponse } from "@/lib/chat/staff";

/** Heartbeats from open admin tabs (every 25 s) and a "leave" beacon when one closes. Best effort. */
export async function POST(request: Request) {
  let adminId: string;
  try {
    adminId = (await requireAdmin()).id;
  } catch (error) {
    return adminAuthResponse(error);
  }
  let state: unknown;
  try {
    state = (JSON.parse(await request.text()) as { state?: unknown }).state;
  } catch {
    return new Response(null, { status: 400 });
  }
  if (state !== "beat" && state !== "leave") return new Response(null, { status: 400 });
  try {
    await (state === "beat" ? staffHeartbeat(adminId) : staffLeft(adminId));
    return new Response(null, { status: 204 });
  } catch (error) {
    unstable_rethrow(error); // framework signals (prerender, redirects) pass through
    console.error("staff presence failed", error);
    return new Response(null, { status: 503 });
  }
}
