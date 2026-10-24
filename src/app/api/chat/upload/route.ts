import { headers } from "next/headers";
import { customerActor } from "@/lib/chat/access";
import { storeChatFile, UploadError } from "@/lib/chat/files";
import { clientIpFrom } from "@/lib/analytics/geo";
import { chatUploadLimiter } from "@/lib/rate-limit";

/** A customer's photo or PDF, saved into their conversation's folder. Sending it is a separate step. */
export async function POST(request: Request) {
  const actor = await customerActor();
  if (!actor) return Response.json({ ok: false, error: "No chat on this device." }, { status: 404 });

  const ip = clientIpFrom(await headers()) ?? "unknown";
  if (await chatUploadLimiter.isLimited(ip, actor.conversationId)) {
    return Response.json({ ok: false, error: "Too many files at once. Wait a few minutes, then try again." }, { status: 429 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, error: "That upload didn't come through. Try again." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ ok: false, error: "Choose a photo or PDF." }, { status: 400 });

  try {
    const data = await storeChatFile(file, actor.conversationId);
    await chatUploadLimiter.record(ip, actor.conversationId);
    return Response.json({ ok: true, data });
  } catch (error) {
    if (error instanceof UploadError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    console.error("chat upload failed", error);
    return Response.json({ ok: false, error: "That file couldn't be sent. Try again." }, { status: 500 });
  }
}
