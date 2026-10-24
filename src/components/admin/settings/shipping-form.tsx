"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LightningIcon, TruckIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { saveShippingMethods } from "@/app/actions/admin/settings";
import { CONTROL, Field, Toggle } from "@/components/admin/ui/form";
import { BUTTON, Card } from "@/components/admin/ui/primitives";
import { centsToDollars, dollarsToCents } from "@/lib/admin/schemas/product";
import { shippingSettingsSchema } from "@/lib/admin/schemas/shipping";
import { formatPrice } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export type ShippingRow = { id: string; code: string; name: string; description: string | null; priceCents: number; isActive: boolean };
type Row = { id: string; code: string; name: string; description: string; price: string; isActive: boolean };

export function ShippingForm({ methods }: { methods: ShippingRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() =>
    methods.map((m) => ({ id: m.id, code: m.code, name: m.name, description: m.description ?? "", price: centsToDollars(m.priceCents), isActive: m.isActive }))
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = (i: number, patch: Partial<Row>) => {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
    setDirty(true);
    setErrors({});
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const priceErrors: Record<string, string> = {};
    const input = rows.map((r, i) => {
      if (!/^\$?\s*[\d,]+(\.\d{1,2})?$/.test(r.price.trim())) priceErrors[`${i}.priceCents`] = "Enter an amount in dollars, like 20 or 19.95";
      return { id: r.id, name: r.name, description: r.description, priceCents: dollarsToCents(r.price) ?? -1, isActive: r.isActive };
    });
    const parsed = shippingSettingsSchema.safeParse(input);
    const clientErrors: Record<string, string> = { ...priceErrors };
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const [i, field] = issue.path;
        clientErrors[typeof i === "number" && field ? `${i}.${String(field)}` : "form"] ??= issue.message;
      }
    }
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      toast.error(clientErrors.form ?? "Some fields need attention.");
      return;
    }
    startTransition(async () => {
      const result = await saveShippingMethods(input);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setDirty(false);
      toast.success("Shipping saved. Checkout uses the new prices now.");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-6">
      {rows.map((row, i) => {
        const Icon = row.code === "express" ? LightningIcon : TruckIcon;
        const cents = dollarsToCents(row.price);
        return (
          <Card key={row.id} className={cn(!row.isActive && "opacity-80")}>
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", row.isActive ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground")}>
                  <Icon weight="fill" className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold">{row.name || "Untitled option"}</h2>
                  <p className="text-xs text-muted-foreground">
                    {row.isActive ? "Shown at checkout" : "Hidden from checkout"} · {cents !== null && cents >= 0 ? formatPrice(cents / 100) : "No price"}
                  </p>
                </div>
              </div>
              <div className="w-auto">
                <Toggle id={`active-${row.id}`} label="On" checked={row.isActive} onChange={(v) => set(i, { isActive: v })} />
              </div>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_12rem]">
              <Field id={`name-${row.id}`} label="Name at checkout" error={errors[`${i}.name`]}>
                <input id={`name-${row.id}`} value={row.name} onChange={(e) => set(i, { name: e.target.value })} aria-invalid={Boolean(errors[`${i}.name`])} className={CONTROL} />
              </Field>
              <Field id={`price-${row.id}`} label="Price" error={errors[`${i}.priceCents`]}>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    id={`price-${row.id}`}
                    inputMode="decimal"
                    value={row.price}
                    onChange={(e) => set(i, { price: e.target.value })}
                    aria-invalid={Boolean(errors[`${i}.priceCents`])}
                    className={cn(CONTROL, "pl-7 font-mono")}
                  />
                </div>
              </Field>
              <Field id={`desc-${row.id}`} label="Description" optional error={errors[`${i}.description`]} hint="One line under the name, like delivery time." className="sm:col-span-2">
                <input id={`desc-${row.id}`} value={row.description} onChange={(e) => set(i, { description: e.target.value })} className={CONTROL} />
              </Field>
            </div>
          </Card>
        );
      })}

      {errors.form && (
        <p role="alert" className="flex gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {errors.form}
        </p>
      )}

      <div className="sticky bottom-0 z-30 -mx-4 border-t border-border bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-2xl lg:border lg:px-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {pending ? "Saving..." : dirty ? "Unsaved changes" : "Prices apply to the next order placed."}
          </p>
          <button type="submit" disabled={pending || !dirty} className={BUTTON.primary}>
            {pending ? "Saving..." : "Save shipping"}
          </button>
        </div>
      </div>
    </form>
  );
}
