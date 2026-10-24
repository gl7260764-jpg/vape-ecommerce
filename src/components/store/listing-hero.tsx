import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs, type Crumb } from "@/components/store/breadcrumbs";
import { cn } from "@/lib/utils";

type Props = {
  crumbs: Crumb[];
  title: string;
  tagline?: string | null;
  count?: number;
  image?: string | null;
  /** Sub-ranges or quick links shown as pills under the title. */
  links?: { label: string; href: string }[];
  /** Small link above the title, e.g. the brand of a series. */
  kicker?: { label: string; href: string } | null;
  /** Hide on phones so products start right under the header (the title stays for screen readers). */
  hideOnMobile?: boolean;
};

/** Header for shop, category and brand listings: title, tagline, count, image tile and sub-range pills. */
export function ListingHero({ crumbs, title, tagline, count, image, links, kicker, hideOnMobile }: Props) {
  return (
    <>
    {hideOnMobile && <h1 className="sr-only lg:hidden">{title}</h1>}
    <section className={cn("relative isolate overflow-hidden border-b border-border", hideOnMobile && "hidden lg:block")}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-10%] -z-10 size-[34rem] rounded-full bg-primary/10 blur-[120px]"
      />
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-4 pt-28 pb-12 sm:px-6 md:pt-32 md:pb-16 lg:grid-cols-12 lg:px-10">
        <div className={cn("flex flex-col", image ? "lg:col-span-8" : "lg:col-span-10")}>
          <Breadcrumbs items={crumbs} />
          {kicker && (
            <Link href={kicker.href} className="mt-8 w-fit text-sm font-medium text-primary-ink hover:underline">
              {kicker.label}
            </Link>
          )}
          {/* With hideOnMobile, the sr-only h1 above serves phones; this one serves desktop. */}
          <h1
            className={cn(
              "font-display text-[clamp(2.25rem,6vw,4.75rem)] leading-[0.92] font-extrabold tracking-[-0.03em] uppercase",
              kicker ? "mt-3" : "mt-8"
            )}
          >
            {title}
          </h1>
          {tagline && <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-muted-foreground">{tagline}</p>}
          {count !== undefined && (
            <p className="mt-5 font-mono text-sm text-muted-foreground">
              {count.toLocaleString("en-AU")} {count === 1 ? "product" : "products"}
            </p>
          )}
          {links && links.length > 0 && (
            <ul className="mt-8 flex flex-wrap gap-2">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="inline-flex h-10 items-center rounded-full border border-border bg-surface/60 px-4 text-sm text-foreground/85 transition-colors hover:border-foreground/30 hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        {image && (
          <div className="hidden items-end justify-end lg:col-span-4 lg:flex">
            <div className="relative aspect-square w-full max-w-[18rem] rotate-[3deg] overflow-hidden rounded-[var(--radius-tile)] bg-tile shadow-[0_30px_60px_-20px_var(--shadow-strong)]">
              <Image src={image} alt="" fill sizes="288px" priority className="object-cover" />
            </div>
          </div>
        )}
      </div>
    </section>
    </>
  );
}
