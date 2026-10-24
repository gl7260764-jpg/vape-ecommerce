"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setCategoryFlag } from "@/app/actions/admin/taxonomy";
import { cn } from "@/lib/utils";

/** Instant on/off for a category's store visibility or homepage feature, saved as you flip it. */
export function FlagSwitch({ id, flag, value, label, disabled }: { id: string; flag: "isVisible" | "isFeatured"; value: boolean; label: string; disabled?: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(value);
  const [pending, startTransition] = useTransition();

  const flip = () => {
    const next = !checked;
    startTransition(async () => {
      const result = await setCategoryFlag(id, flag, next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setChecked(next);
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={pending || disabled}
      onClick={flip}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full ring-1 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
        checked ? "bg-primary ring-primary" : "bg-surface-2 ring-border"
      )}
    >
      <span className={cn("ml-1 size-4 rounded-full transition-transform", checked ? "translate-x-5 bg-primary-foreground" : "bg-foreground/60", pending && "animate-pulse")} />
    </button>
  );
}
