"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveBusinessDetails } from "@/app/actions/admin/settings";
import { CONTROL, Field } from "@/components/admin/ui/form";
import { BUTTON, Card } from "@/components/admin/ui/primitives";
import { cn } from "@/lib/utils";

type Values = { email: string; phone: string; address: string; abn: string };

/** The four details printed in the invoice header. With an ABN, invoices are titled "TAX INVOICE". */
export function BusinessForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const set = (key: keyof Values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors({});
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveBusinessDetails(values);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success("Business details saved");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="mt-8 max-w-2xl">
      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field id="business-email" label="Email" optional error={errors.email}>
            <input id="business-email" type="email" value={values.email} onChange={(e) => set("email", e.target.value)} className={CONTROL} aria-invalid={Boolean(errors.email)} />
          </Field>
          <Field id="business-phone" label="Phone" optional error={errors.phone}>
            <input id="business-phone" type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} className={CONTROL} aria-invalid={Boolean(errors.phone)} />
          </Field>
        </div>
        <Field id="business-address" label="Address" optional error={errors.address} hint="Shown as written, one line per line.">
          <textarea
            id="business-address"
            rows={3}
            value={values.address}
            onChange={(e) => set("address", e.target.value)}
            className={cn(CONTROL, "h-auto py-2.5")}
            aria-invalid={Boolean(errors.address)}
          />
        </Field>
        <Field id="business-abn" label="ABN" optional error={errors.abn} hint="With an ABN, invoices are titled TAX INVOICE and show it.">
          <input id="business-abn" inputMode="numeric" value={values.abn} onChange={(e) => set("abn", e.target.value)} className={cn(CONTROL, "sm:w-60")} aria-invalid={Boolean(errors.abn)} />
        </Field>
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <button type="submit" disabled={pending} className={BUTTON.primary}>
            Save details
          </button>
          <p className="text-sm text-muted-foreground">Invoices already sent keep the details they were sent with.</p>
        </div>
      </Card>
    </form>
  );
}
