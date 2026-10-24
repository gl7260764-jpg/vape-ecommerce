// Flavour names come from the database via the homepage.
import { cn } from "@/lib/utils";

/** The page's one marquee: shows the breadth of the flavour range at a glance. */
export function FlavourMarquee({ names }: { names: string[] }) {
  const row = [...names, ...names];

  return (
    <section aria-label="Flavours in stock" className="relative overflow-hidden border-y border-border py-6 md:py-8">
      <div
        className="group flex w-max animate-marquee hover:[animation-play-state:paused]"
        style={{ "--marquee-duration": "70s" } as React.CSSProperties}
      >
        {row.map((name, i) => (
          <span
            key={`${name}-${i}`}
            aria-hidden={i >= names.length}
            className="flex items-center font-display text-3xl font-bold whitespace-nowrap uppercase md:text-5xl"
          >
            <span
              className={cn(
                "px-6 md:px-9",
                i % 2 === 1 ? "text-transparent [-webkit-text-stroke:1.2px_var(--muted-foreground)]" : "text-foreground"
              )}
            >
              {name}
            </span>
            <span aria-hidden className="size-2.5 rounded-full bg-primary md:size-3" />
          </span>
        ))}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent" />
    </section>
  );
}
