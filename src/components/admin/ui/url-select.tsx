"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/admin/ui/form";

/** A filter dropdown whose value lives in the URL. Empty value removes the param. */
export function UrlSelect({ name, label, options, allLabel }: { name: string; label: string; options: { value: string; label: string }[]; allLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      aria-label={label}
      value={params.get(name) ?? ""}
      disabled={pending}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        if (e.target.value) next.set(name, e.target.value);
        else next.delete(name);
        next.delete("page");
        const qs = next.toString();
        startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
      }}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
