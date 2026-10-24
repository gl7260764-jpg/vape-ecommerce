"use server";

import { z } from "zod";
import { customerActor } from "@/lib/chat/access";
import { answerInvoice as answer, ChatError, chatErrorMessage, deleteMessage, editMessage, markReceipts, react, sendMessage } from "@/lib/chat/service";
import type { ChatMessageDTO } from "@/lib/chat/types";
import { fail, ok, type ActionResult } from "@/lib/admin/result";

// The customer's side of the chat. Every action works out the conversation from this device's
// cookie; nothing the browser sends can point it at another conversation.

type CustomerActor = NonNullable<Awaited<ReturnType<typeof customerActor>>>;

async function asCustomer<T>(run: (actor: CustomerActor) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const actor = await customerActor();
    if (!actor) return fail("This chat isn't available on this device.");
    return ok(await run(actor));
  } catch (error) {
    if (error instanceof ChatError) return fail(chatErrorMessage(error.code));
    console.error("customer chat action failed", error);
    return fail("Something went wrong. Please try again.");
  }
}

const attachmentInput = z
  .object({
    key: z.string().max(200),
    name: z.string().max(200),
    mime: z.string().max(100),
    size: z.number().int().nonnegative(),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
  })
  .nullable()
  .optional();

const sendInput = z.object({
  id: z.string().max(40),
  body: z.string().max(5000),
  replyToId: z.string().max(40).nullable().optional(),
  attachment: attachmentInput,
});

export async function sendCustomerMessage(input: z.input<typeof sendInput>): Promise<ActionResult<ChatMessageDTO>> {
  const parsed = sendInput.safeParse(input);
  if (!parsed.success) return fail("That message couldn't be sent.");
  return asCustomer((actor) => sendMessage(actor, { ...parsed.data, conversationId: actor.conversationId }));
}

export async function editCustomerMessage(input: { id: string; body: string }): Promise<ActionResult<ChatMessageDTO>> {
  return asCustomer((actor) => editMessage(actor, { id: String(input.id), body: String(input.body) }));
}

export async function deleteCustomerMessage(input: { id: string }): Promise<ActionResult<ChatMessageDTO>> {
  return asCustomer((actor) => deleteMessage(actor, { id: String(input.id) }));
}

export async function reactCustomer(input: { id: string; emoji: string | null }): Promise<ActionResult<null>> {
  return asCustomer(async (actor) => {
    await react(actor, { id: String(input.id), emoji: input.emoji === null ? null : String(input.emoji) });
    return null;
  });
}

export async function customerReceipts(input: { kind: "delivered" | "read"; upTo: string }): Promise<ActionResult<null>> {
  if (input.kind !== "delivered" && input.kind !== "read") return fail("Unknown receipt.");
  return asCustomer(async (actor) => {
    await markReceipts(actor, { conversationId: actor.conversationId, kind: input.kind, upTo: String(input.upTo) });
    return null;
  });
}

/** "Yes, all correct" or "Something's wrong" under an invoice. Returns the answer and the automatic reply. */
export async function answerInvoice(input: { invoiceId: string; answer: "confirmed" | "disputed" }): Promise<ActionResult<ChatMessageDTO[]>> {
  return asCustomer((actor) => answer(actor, { invoiceId: String(input.invoiceId), answer: input.answer }));
}
