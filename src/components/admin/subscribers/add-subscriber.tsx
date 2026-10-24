"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PlusIcon } from "@phosphor-icons/react";
import { addSubscriber } from "@/app/actions/admin/subscribers";
import { CONTROL } from "@/components/admin/ui/form";
import { BUTTON } from "@/components/admin/ui/primitives";
import { cn } from "@/lib/utils";

/** Inline "add by hand" form for people who asked to join in person or by message. */
export function AddSubscriber() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await addSubscriber(email);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          toast.success(result.data.created ? `${email.trim().toLowerCase()} added` : "Already on the list");
          setEmail("");
          router.refresh();
        });
      }}
      className="flex flex-col gap-1.5"
    >
      <div className="flex gap-2">
        <label htmlFor="new-subscriber" className="sr-only">
          Email to add
        </label>
        <input
          id="new-subscriber"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="Add an email by hand"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          aria-invalid={Boolean(error)}
          className={cn(CONTROL, "sm:w-72")}
        />
        <button type="submit" disabled={pending || !email.trim()} className={cn(BUTTON.secondary, "shrink-0 px-4")}>
          <PlusIcon className="size-4" aria-hidden /> {pending ? "Adding..." : "Add"}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
