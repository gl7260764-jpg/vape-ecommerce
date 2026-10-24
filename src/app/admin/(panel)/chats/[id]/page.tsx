import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ContextPanel } from "@/components/admin/chat/context-panel";
import { Thread } from "@/components/admin/chat/thread";
import { can, requireAdminPage } from "@/lib/admin/auth";
import { conversationContext, getConversation } from "@/lib/chat/inbox";

export const metadata: Metadata = { title: "Chat" };

async function ChatView({ params }: Pick<PageProps<"/admin/chats/[id]">, "params">) {
  const admin = await requireAdminPage();
  const { id } = await params;
  const [conversation, context] = await Promise.all([getConversation(id), conversationContext(id)]);
  if (!conversation || !context) notFound();
  return (
    <Thread
      key={conversation.id}
      conversation={conversation}
      canModerate={can(admin.role, "people:manage")}
      details={<ContextPanel conversation={conversation} context={context} />}
    />
  );
}

export default function ChatPage({ params }: PageProps<"/admin/chats/[id]">) {
  return (
    <Suspense fallback={<div className="flex-1 animate-pulse bg-background" aria-label="Loading chat" />}>
      <ChatView params={params} />
    </Suspense>
  );
}
