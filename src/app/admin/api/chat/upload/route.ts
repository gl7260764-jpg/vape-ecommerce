import { requireAdmin } from "@/lib/admin/auth";
import { storeChatFile, UploadError } from "@/lib/chat/files";
import { prisma } from "@/lib/db";
import { adminAuthResponse } from "@/lib/chat/staff";

/** A team member's photo or PDF for `?conversationId=`, saved into that conversation's folder. Sending is a separate step. */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (error) {
    return adminAuthResponse(error);
  }
  const conversationId = new URL(request.url).searchParams.get("conversationId") ?? "";
  const exists = /^[a-z0-9]{20,40}$/.test(conversationId) && (await prisma.chatConversation.count({ where: { id: conversationId } })) > 0;
  if (!exists) return Response.json({ ok: false, error: "That chat no longer exists." }, { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, error: "That upload didn't come through. Try again." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ ok: false, error: "Choose a photo or PDF." }, { status: 400 });
  try {
    return Response.json({ ok: true, data: await storeChatFile(file, conversationId) });
  } catch (error) {
    if (error instanceof UploadError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    console.error("admin chat upload failed", error);
    return Response.json({ ok: false, error: "That file couldn't be sent. Try again." }, { status: 500 });
  }
}
