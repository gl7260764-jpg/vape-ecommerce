import type { Metadata } from "next";
import { Suspense } from "react";
import { Inbox } from "@/components/admin/chat/inbox";
import { requireAdminPage } from "@/lib/admin/auth";
import { listInbox } from "@/lib/chat/inbox";

export const metadata: Metadata = { title: "Chats" };

// Chats take the whole screen beside the admin sidebar (under the top bar on phones): the list on
// the left, the open conversation beside it. On phones the list and the conversation take turns.
const FRAME = "fixed inset-x-0 top-14 bottom-0 z-30 flex overflow-hidden bg-surface lg:top-0 lg:left-64";

async function ChatsFrame({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  const initial = { now: new Date().toISOString(), ...(await listInbox()) };
  return (
    <div className={FRAME}>
      <Inbox initial={initial} />
      {children}
    </div>
  );
}

function FrameSkeleton() {
  return (
    <div className={FRAME} aria-label="Loading chats">
      <div className="flex w-full flex-col gap-3 p-4 lg:w-[300px] lg:border-r lg:border-border xl:w-[340px]">
        <div className="h-7 w-24 animate-pulse rounded-full bg-surface-2" />
        <div className="h-10 animate-pulse rounded-full bg-surface-2" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface-2" />
        ))}
      </div>
    </div>
  );
}

export default function ChatsLayout({ children }: LayoutProps<"/admin/chats">) {
  return (
    <Suspense fallback={<FrameSkeleton />}>
      <ChatsFrame>{children}</ChatsFrame>
    </Suspense>
  );
}
