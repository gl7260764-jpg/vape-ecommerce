"use client";

import { useState } from "react";
import { CodeIcon, EyeIcon } from "@phosphor-icons/react";
import { CONTROL } from "@/components/admin/ui/form";
import { cn } from "@/lib/utils";

/** HTML description with a Write/Preview switch. The preview is sandboxed, so nothing in the HTML can run. */
export function HtmlField({ id, label, value, onChange, rows = 12 }: { id: string; label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  const [preview, setPreview] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label} <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <div className="flex rounded-full border border-border p-0.5 text-xs">
          {[
            { on: false, label: "Write", icon: CodeIcon },
            { on: true, label: "Preview", icon: EyeIcon },
          ].map(({ on, label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => setPreview(on)}
              aria-pressed={preview === on}
              className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 font-medium", preview === on ? "bg-foreground text-background" : "text-muted-foreground")}
            >
              <Icon className="size-3.5" aria-hidden /> {label}
            </button>
          ))}
        </div>
      </div>
      {preview ? (
        // Sandboxed: imported HTML is shown without running anything it contains.
        <iframe
          title="Description preview"
          sandbox=""
          srcDoc={`<style>body{font:15px/1.6 system-ui,sans-serif;color:#1d1f24;margin:16px}h2,h3{line-height:1.2}a{color:#4a6b00}</style>${value || "<p style='color:#888'>Nothing written yet.</p>"}`}
          className="h-80 w-full rounded-xl border border-input bg-white"
        />
      ) : (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className={cn(CONTROL, "h-auto resize-y py-3 font-mono text-[0.8rem] leading-relaxed")}
        />
      )}
      <p className="text-xs text-muted-foreground">Basic HTML works: &lt;p&gt;, &lt;h3&gt;, &lt;ul&gt;&lt;li&gt;, &lt;strong&gt;, links. Styling and scripts are removed in the store.</p>
    </div>
  );
}
