"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { setEnquiryDone } from "@/app/actions/admin/enquiries";
import { BUTTON } from "@/components/admin/ui/primitives";

/** "Mark as done" on a new enquiry, "Move back to new" on a done one. */
export function EnquiryDoneButton({ id, done }: { id: string; done: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const toggle = () =>
    startTransition(async () => {
      const result = await setEnquiryDone({ id, done: !done });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  return (
    <button type="button" onClick={toggle} disabled={pending} className={BUTTON.secondary}>
      {done ? "Move back to new" : "Mark as done"}
    </button>
  );
}
