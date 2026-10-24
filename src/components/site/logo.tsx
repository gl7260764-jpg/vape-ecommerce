import { cn } from "@/lib/utils";

/** Wordmark in the display face. Swap for the client's logo file when supplied. */
export function Logo({ className, subtitleClassName, wordmarkClassName }: { className?: string; subtitleClassName?: string; wordmarkClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-full bg-primary font-display text-[0.8rem] font-black text-primary-foreground"
      >
        B
      </span>
      <span className={cn("flex flex-col leading-none", wordmarkClassName)}>
        <span className="font-display text-[0.95rem] font-extrabold tracking-tight uppercase">Best Vape</span>
        <span className={cn("mt-0.5 text-[0.62rem] font-medium tracking-[0.2em] text-muted-foreground uppercase", subtitleClassName)}>
          Shop Australia
        </span>
      </span>
    </span>
  );
}
