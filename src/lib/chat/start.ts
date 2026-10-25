import "server-only";
import { randomUUID } from "node:crypto";
import { openAccount } from "@/lib/account";
import { MAX_BODY } from "@/lib/chat/rules";
import { ChatError, sendMessage } from "@/lib/chat/service";

/**
 * The live chat's first message: opens the account for this email on this device (a device already
 * signed in keeps its account and its chat) and sends the message from the customer.
 */
export async function startChat(tokenHash: string, email: string, message: string): Promise<{ conversationId: string; email: string }> {
  const body = message.trim();
  // Checked before the account is opened, so a refused message leaves nothing behind.
  if (!body) throw new ChatError("EMPTY");
  if (body.length > MAX_BODY) throw new ChatError("TOO_LONG");
  const account = await openAccount(tokenHash, email);
  await sendMessage({ kind: "customer", conversationId: account.conversationId }, { id: randomUUID(), conversationId: account.conversationId, body });
  return { conversationId: account.conversationId, email: account.email };
}
