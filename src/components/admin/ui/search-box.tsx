"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { CONTROL } from "@/components/admin/ui/form";
import { cn } from "@/lib/utils";

/** Debounced search that writes `q` to the URL (keeping every other param, resetting the page). */
export function SearchBox({ placeholder, className }: { placeholder: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const push = (q: string) => {
    const next = new URLSearchParams(params.toString());
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className={cn("relative", className)}>
      <MagnifyingGlassIcon className={cn("pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground", pending && "animate-pulse")} aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => push(e.target.value), 300);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(CONTROL, "pr-9 pl-10 [&::-webkit-search-cancel-button]:hidden")}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            push("");
          }}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}
