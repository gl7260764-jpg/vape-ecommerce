"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowClockwiseIcon, CloudSlashIcon } from "@phosphor-icons/react";
import { BUTTON } from "@/components/admin/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Admin pages almost always fail for one reason: the database is waking from idle.
 * Explain that calmly, retry once by itself after a few seconds, and offer a manual retry.
 */
export function AdminErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [autoRetried, setAutoRetried] = useState(false);
  const retried = useRef(false);

  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  useEffect(() => {
    if (retried.current) return;
    retried.current = true;
    const t = setTimeout(() => {
      setAutoRetried(true);
      retry();
    }, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one silent retry per error
  }, []);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-surface-2">
        <CloudSlashIcon className="size-6 text-muted-foreground" aria-hidden />
      </span>
      <h1 className="mt-6 text-lg font-semibold">This page didn&apos;t load</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        This is usually the database waking from sleep, not lost data. It normally clears in a few seconds.
        {!autoRetried && " Retrying automatically..."}
      </p>
      <div className="mt-7 flex gap-2">
        <button type="button" onClick={retry} disabled={pending} className={BUTTON.primary}>
          <ArrowClockwiseIcon className={cn("size-4", pending && "animate-spin")} aria-hidden />
          Try again
        </button>
        <Link href="/" className={BUTTON.secondary}>
          Back to site
        </Link>
      </div>
      {error.digest && <p className="mt-6 font-mono text-xs text-muted-foreground">Ref {error.digest}</p>}
    </div>
  );
}
