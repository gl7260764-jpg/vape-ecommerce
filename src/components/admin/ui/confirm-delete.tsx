"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { TrashIcon } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { BUTTON } from "@/components/admin/ui/primitives";
import type { ActionResult } from "@/lib/admin/result";
import { cn } from "@/lib/utils";

export type DeleteOutcome = { action: "deleted" | "archived" };

/**
 * Asks for confirmation naming the record, runs the delete action, toasts what actually
 * happened (deleted or archived) and refreshes, or navigates to `redirectTo`.
 */
export function ConfirmDelete({
  name,
  kind,
  action,
  redirectTo,
  note,
  variant = "icon",
}: {
  name: string;
  kind: string;
  action: () => Promise<ActionResult<DeleteOutcome>>;
  redirectTo?: string;
  note?: string;
  variant?: "icon" | "button" | "bar";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.action === "archived" ? `${name} was archived (it appears in past orders)` : `${name} deleted`);
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });

  const trigger =
    variant === "icon" ? (
      <button type="button" onClick={() => setOpen(true)} aria-label={`Delete ${name}`} className={cn(BUTTON.icon, "hover:bg-destructive/10 hover:text-destructive")}>
        <TrashIcon className="size-4" />
      </button>
    ) : variant === "bar" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 flex-1 items-center justify-center gap-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5"
      >
        <TrashIcon className="size-4" aria-hidden /> Delete
      </button>
    ) : (
      <button type="button" onClick={() => setOpen(true)} className={cn(BUTTON.secondary, "text-destructive hover:border-destructive/50")}>
        <TrashIcon className="size-4" aria-hidden /> Delete {kind}
      </button>
    );

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Delete {kind}?</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{name}</span> will be removed from the store. This can&apos;t be undone.
            {note && <span className="mt-2 block">{note}</span>}
          </DialogDescription>
          <DialogFooter className="gap-2">
            <button type="button" onClick={() => setOpen(false)} disabled={pending} className={BUTTON.secondary}>
              Cancel
            </button>
            <button type="button" onClick={run} disabled={pending} className={BUTTON.danger}>
              {pending ? "Deleting..." : `Delete ${kind}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
