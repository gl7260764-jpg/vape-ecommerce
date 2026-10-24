"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveNewsletterSettings } from "@/app/actions/admin/settings";
import { CONTROL, Field, Toggle } from "@/components/admin/ui/form";
import { BUTTON, Card } from "@/components/admin/ui/primitives";
import { cn } from "@/lib/utils";

type Mode = "forever" | "times";
type Values = { popupEnabled: boolean; installOffersEnabled: boolean; firstDelaySeconds: string; repeatEverySeconds: string; mode: Mode; maxShows: string };

const MODES: { value: Mode; label: string; hint: (every: string) => string }[] = [
  { value: "forever", label: "Until they subscribe", hint: (every) => `Comes back every ${every || "few"} seconds for as long as they browse.` },
  { value: "times", label: "A set number of times", hint: () => "Stops for good once it has been shown that many times on their device." },
];

// Blank stays blank so the server says what's missing, instead of quietly saving 0.
const num = (v: string) => (v.trim() === "" ? Number.NaN : Number(v));

/** When the store's newsletter pop-up first appears, how often it comes back, and when it gives up. */
export function NewsletterForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors({});
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveNewsletterSettings({
        popupEnabled: values.popupEnabled,
        installOffersEnabled: values.installOffersEnabled,
        firstDelaySeconds: num(values.firstDelaySeconds),
        repeatEverySeconds: num(values.repeatEverySeconds),
        mode: values.mode,
        maxShows: values.mode === "times" ? num(values.maxShows) : undefined,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success("Pop-up settings saved");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 max-w-2xl">
      <Card className="flex flex-col gap-6 p-5 sm:p-6">
        <Toggle
          id="popup-enabled"
          label="Show the pop-up"
          description="Off hides it everywhere. The 10% still applies to anyone who subscribes from the footer."
          checked={values.popupEnabled}
          onChange={(on) => set("popupEnabled", on)}
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field id="popup-first" label="First show after (seconds)" error={errors.firstDelaySeconds} hint="Seconds on the site before it first appears.">
            <input
              id="popup-first"
              type="number"
              inputMode="numeric"
              min={0}
              max={600}
              value={values.firstDelaySeconds}
              onChange={(e) => set("firstDelaySeconds", e.target.value)}
              className={CONTROL}
              aria-invalid={Boolean(errors.firstDelaySeconds)}
            />
          </Field>
          <Field id="popup-every" label="If they close it, show it again every (seconds)" error={errors.repeatEverySeconds} hint="At least 3 seconds.">
            <input
              id="popup-every"
              type="number"
              inputMode="numeric"
              min={3}
              max={86400}
              value={values.repeatEverySeconds}
              onChange={(e) => set("repeatEverySeconds", e.target.value)}
              className={CONTROL}
              aria-invalid={Boolean(errors.repeatEverySeconds)}
            />
          </Field>
        </div>
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium">Keep showing it</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {MODES.map((m) => (
              <label
                key={m.value}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                  values.mode === m.value ? "border-primary bg-primary/[0.06]" : "border-border hover:border-foreground/30"
                )}
              >
                <input type="radio" name="mode" value={m.value} checked={values.mode === m.value} onChange={() => set("mode", m.value)} className="mt-0.5 size-4 accent-[var(--primary)]" />
                <span>
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className="block text-xs text-muted-foreground">{m.hint(values.repeatEverySeconds)}</span>
                </span>
              </label>
            ))}
          </div>
          <Field id="popup-max" label="Stop after (times)" error={errors.maxShows} className="sm:w-60">
            <input
              id="popup-max"
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={values.maxShows}
              disabled={values.mode !== "times"}
              onChange={(e) => set("maxShows", e.target.value)}
              className={CONTROL}
              aria-invalid={Boolean(errors.maxShows)}
            />
          </Field>
        </fieldset>
        <div className="border-t border-border pt-5">
          <Toggle
            id="install-offers"
            label="Show the app install card and pop-up"
            description="The install card at the bottom, the navbar's install icon, and the install pop-up after subscribing (on the timing above). The app and its 10% work either way."
            checked={values.installOffersEnabled}
            onChange={(on) => set("installOffersEnabled", on)}
          />
        </div>
        <p className="border-t border-border pt-5 text-sm text-muted-foreground">
          Never shown to people who already subscribed on this device, on the checkout, order and invoice pages, before the 18+ age check, or in the admin.
        </p>
        <div>
          <button type="submit" disabled={pending} className={BUTTON.primary}>
            Save
          </button>
        </div>
      </Card>
    </form>
  );
}
