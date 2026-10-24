import Image from "next/image";
import Link from "next/link";
import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr";
import type { Category } from "@/lib/catalog";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

// Checkerboard bento: wide, narrow / narrow, wide. Exactly one cell per category.
const layout = [
  { span: "lg:col-span-7", glow: "bg-[radial-gradient(120%_90%_at_100%_100%,oklch(0.9_0.175_123/16%),transparent_60%)]" },
  { span: "lg:col-span-5", glow: "bg-[radial-gradient(100%_80%_at_0%_100%,oklch(1_0_0/7%),transparent_65%)]" },
  { span: "lg:col-span-5", glow: "bg-[radial-gradient(90%_90%_at_100%_0%,oklch(1_0_0/6%),transparent_60%)]" },
  { span: "lg:col-span-7", glow: "bg-[linear-gradient(135deg,oklch(0.9_0.175_123/12%),transparent_55%)]" },
];

export function Categories({ categories }: { categories: Category[] }) {
  return (
    <section aria-labelledby="brands-title" className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6 md:py-32 lg:px-10">
      <Reveal>
        <div data-stagger className="max-w-2xl">
          <h2 id="brands-title" className="font-display text-4xl leading-[0.95] font-extrabold tracking-[-0.03em] uppercase md:text-6xl">
            Shop by brand
          </h2>
          <p className="mt-5 max-w-[48ch] text-lg leading-relaxed text-muted-foreground">
            The names Australians ask for most, from compact bars to 40,000-puff screens.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:mt-16 md:grid-cols-2 lg:grid-cols-12 lg:gap-5">
          {categories.map((category, i) => {
            const cell = layout[i];
            const isPack = category.slug === "alibarbar-ingot";
            return (
              <Link
                key={category.slug}
                href={`/product-category/${category.slug}`}
                data-stagger
                className={cn(
                  "group relative isolate flex min-h-[19rem] overflow-hidden rounded-[var(--radius-tile)] border border-border bg-surface p-6 transition-colors duration-500 hover:border-foreground/20 md:min-h-[22rem] md:p-8",
                  cell.span
                )}
              >
                <div aria-hidden className={cn("absolute inset-0 -z-10", cell.glow)} />

                <div className="relative z-10 flex max-w-full flex-col md:max-w-[60%]">
                  <p className="font-mono text-sm text-muted-foreground">
                    {category.count} {category.count === 1 ? "product" : "products"}
                  </p>
                  <h3 className="mt-auto font-display text-2xl leading-[0.95] font-extrabold uppercase md:text-[2rem]">
                    {category.name}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{category.blurb}</p>
                </div>

                <div
                  className={cn(
                    // Mobile: image top-right above the copy. md+: bottom-right beside it.
                    "absolute top-5 right-5 aspect-square w-[36%] max-w-[13.5rem] overflow-hidden rounded-2xl shadow-[0_30px_60px_-20px_var(--shadow-strong)] transition-transform duration-700 ease-[var(--ease-out-expo)] md:top-auto md:right-7 md:bottom-7 md:w-[42%]",
                    i % 2 === 0 ? "rotate-[-5deg]" : "rotate-[4deg]",
                    "group-hover:-translate-y-2 group-hover:rotate-0 group-hover:scale-[1.04]",
                    isPack && "bg-tile"
                  )}
                >
                  <Image
                    src={category.image}
                    alt={`${category.name} range`}
                    fill
                    sizes="(min-width: 1024px) 256px, 44vw"
                    className={cn(isPack ? "object-contain p-3" : "object-cover")}
                  />
                </div>

                <span className="absolute top-5 right-5 hidden size-11 place-items-center md:grid rounded-full border border-border bg-background/60 text-foreground backdrop-blur transition-all duration-500 ease-[var(--ease-out-expo)] group-hover:rotate-45 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground md:top-7 md:right-7">
                  <ArrowUpRightIcon weight="bold" className="size-4" />
                </span>
              </Link>
            );
          })}
        </div>
      </Reveal>
    </section>
  );
}
