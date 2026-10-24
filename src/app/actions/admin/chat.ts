"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { fail, ok, toActionError, type ActionResult } from "@/lib/admin/result";
import { ChatError, chatErrorMessage, deleteMessage, editMessage, markReceipts, react, sendMessage } from "@/lib/chat/service";
import { staffActorFor, type StaffActor } from "@/lib/chat/staff";
import type { ChatMessageDTO } from "@/lib/chat/types";

// The team's side of the chat. Every action checks the session first; the chat service then checks
// the message rules (own messages only, except that the owner can remove anyone's).

async function asStaff<T>(run: (actor: StaffActor) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const admin = await requireAdmin();
    return ok(await run(staffActorFor(admin)));
  } catch (error) {
    if (error instanceof ChatError) return fail(chatErrorMessage(error.code));
    return toActionError(error);
  }
}

const sendInput = z.object({
  conversationId: z.string().max(40),
  id: z.string().max(40),
  body: z.string().max(5000),
  replyToId: z.string().max(40).nullable().optional(),
  attachment: z
    .object({
      key: z.string().max(200),
      name: z.string().max(200),
      mime: z.string().max(100),
      size: z.number().int().nonnegative(),
      width: z.number().int().positive().nullable(),
      height: z.number().int().positive().nullable(),
    })
    .nullable()
    .optional(),
});

export async function sendStaffMessage(input: z.input<typeof sendInput>): Promise<ActionResult<ChatMessageDTO>> {
  return asStaff((actor) => {
    const parsed = sendInput.safeParse(input);
    if (!parsed.success) throw new ChatError("INVALID");
    return sendMessage(actor, parsed.data);
  });
}

export async function editStaffMessage(input: { id: string; body: string }): Promise<ActionResult<ChatMessageDTO>> {
  return asStaff((actor) => editMessage(actor, { id: String(input.id), body: String(input.body) }));
}

/** Your own message, or anyone's for the owner. */
export async function deleteChatMessage(input: { id: string }): Promise<ActionResult<ChatMessageDTO>> {
  return asStaff((actor) => deleteMessage(actor, { id: String(input.id) }));
}

export async function reactStaff(input: { id: string; emoji: string | null }): Promise<ActionResult<null>> {
  return asStaff(async (actor) => {
    await react(actor, { id: String(input.id), emoji: input.emoji === null ? null : String(input.emoji) });
    return null;
  });
}

export async function staffReceipts(input: { conversationId: string; kind: "delivered" | "read"; upTo: string }): Promise<ActionResult<null>> {
  return asStaff(async (actor) => {
    if (input.kind !== "delivered" && input.kind !== "read") throw new ChatError("INVALID");
    await markReceipts(actor, { conversationId: String(input.conversationId), kind: input.kind, upTo: String(input.upTo) });
    return null;
  });
}
