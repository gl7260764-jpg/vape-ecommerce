"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { forgetOrders } from "@/app/actions/orders";
import { useChatUi } from "@/components/chat/chat-ui-store";

/** Two-step "sign out on this device", for shared or borrowed phones and computers. */
export function SignOut() {
  const router = useRouter();
  const reloadStatus = useChatUi((s) => s.reloadStatus);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Sign out on this device
      </button>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted-foreground">Sign out here? You can sign back in with your email; past orders then show as summaries on this device.</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await forgetOrders();
            if (!result.ok) {
              toast.error("That didn't work. Please try again.");
              return;
            }
            toast.success("Signed out on this device");
            setConfirming(false);
            reloadStatus();
            router.refresh();
          })
        }
        className="inline-flex h-9 items-center rounded-full bg-destructive px-4 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Signing out..." : "Yes, sign out"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="inline-flex h-9 items-center rounded-full border border-border px-4 font-medium">
        Cancel
      </button>
    </p>
  );
}
