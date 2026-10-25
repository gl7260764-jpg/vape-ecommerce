"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { clientIpFrom } from "@/lib/analytics/geo";
import { currentVisit } from "@/lib/analytics/record";
import { markAccountInstalled } from "@/lib/app-install";
import { customerActor } from "@/lib/chat/access";
import { startChat } from "@/lib/chat/start";
import { deviceTokenHashForWrite } from "@/lib/customer-orders";
import { chatStartLimiter } from "@/lib/rate-limit";
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

const startEmail = z.string().trim().toLowerCase().max(254).pipe(z.email());

export type StartChatResult = { ok: true; email: string } | { ok: false; error: string };

/**
 * The live chat's first message, from a device with no chat yet: opens the account for the email (or
 * signs this device into it) and sends the message. A tight limit (3 per IP, 2 per email every 15 minutes) and `website`, a
 * field people never see, keep scripts from filling the team's inbox.
 */
export async function startChatAction(input: { email: string; message: string; website?: string }): Promise<StartChatResult> {
  const failed = { ok: false as const, error: "Something went wrong. Please try again in a moment." };
  if (input?.website) return failed;
  const parsed = startEmail.safeParse(input?.email ?? "");
  if (!parsed.success) return { ok: false, error: "Enter a valid email, like name@example.com." };
  const message = String(input?.message ?? "").trim();
  if (!message) return { ok: false, error: "Type a message to send." };

  try {
    const ip = clientIpFrom(await headers()) ?? "unknown";
    if (await chatStartLimiter.isLimited(ip, parsed.data)) return { ok: false, error: "Too many tries. Wait 15 minutes, then try again." };
    await chatStartLimiter.record(ip, parsed.data);
    const tokenHash = await deviceTokenHashForWrite();
    const started = await startChat(tokenHash, parsed.data, message);
    await markAccountInstalled({ visitorId: (await currentVisit()).visitorId, tokenHash }).catch((error) => console.error("mark account installed failed", error));
    return { ok: true, email: started.email };
  } catch (error) {
    if (error instanceof ChatError) return { ok: false, error: chatErrorMessage(error.code) };
    console.error("start chat failed", error);
    return failed;
  }
}
