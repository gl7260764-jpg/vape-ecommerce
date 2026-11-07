/** The answer up top, before the detail: what someone who only reads this box should know. */
export function ShortAnswer({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-[var(--radius-tile)] border border-primary/40 bg-primary/[0.07] p-5 md:p-6">
      <p className="font-display text-sm font-bold tracking-wide text-primary-ink uppercase">The short version</p>
      <div className="mt-2 [&>p]:mt-2 [&>p:first-child]:mt-0">{children}</div>
    </div>
  );
}
