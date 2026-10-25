"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveAlertSettings, sendAlertTest } from "@/app/actions/admin/settings";
import { CONTROL, Field } from "@/components/admin/ui/form";
import { BUTTON, Card } from "@/components/admin/ui/primitives";
import { cn } from "@/lib/utils";

/** A long random topic name: anyone who knows it can read the alerts. */
function makeTopic() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `bvsa-${Array.from(bytes, (b) => (b % 36).toString(36)).join("")}`;
}

/** The ntfy topic, with the steps to subscribe on a phone and a test button. */
export function AlertsForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [topic, setTopic] = useState(initial);
  const [error, setError] = useState<string>();
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();
  const set = (value: string) => {
    setTopic(value);
    setError(undefined);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startSave(async () => {
      const result = await saveAlertSettings({ topic });
      if (!result.ok) {
        setError(result.fieldErrors?.topic);
        toast.error(result.error);
        return;
      }
      toast.success(result.data.on ? "Phone alerts saved" : "Phone alerts turned off");
      router.refresh();
    });
  };
  const test = () =>
    startTest(async () => {
      const result = await sendAlertTest({ topic });
      if (!result.ok) {
        setError(result.fieldErrors?.topic);
        toast.error(result.error);
        return;
      }
      toast.success("Test sent. Check your phone.");
    });

  return (
    <form onSubmit={onSubmit} className="mt-8 max-w-2xl">
      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <ol className="grid list-decimal gap-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            Install the free <strong className="text-foreground">ntfy</strong> app on your phone (App Store or Google Play).
          </li>
          <li>
            Press <strong className="text-foreground">Make a topic</strong>, then <strong className="text-foreground">Save</strong>.
          </li>
          <li>In ntfy, tap +, paste the topic and subscribe. Anyone on your team can do the same.</li>
          <li>
            Press <strong className="text-foreground">Send test</strong> to check it arrives.
          </li>
        </ol>
        <Field id="alert-topic" label="Topic" error={error} hint="Anyone who knows it can read your alerts, so keep it private. Leave it empty to turn alerts off.">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="alert-topic"
              value={topic}
              onChange={(e) => set(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className={cn(CONTROL, "font-mono")}
              aria-invalid={Boolean(error)}
            />
            <button type="button" onClick={() => set(makeTopic())} className={cn(BUTTON.secondary, "shrink-0")}>
              Make a topic
            </button>
          </div>
        </Field>
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <button type="submit" disabled={saving} className={BUTTON.primary}>
            Save
          </button>
          <button type="button" onClick={test} disabled={testing || !topic.trim()} className={BUTTON.secondary}>
            Send test
          </button>
        </div>
      </Card>
    </form>
  );
}
