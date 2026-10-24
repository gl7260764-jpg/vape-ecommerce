import Image from "next/image";
import Link from "next/link";
import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr";

type Props = {
  href: string;
  name: string;
  count: number;
  image: string | null;
  tagline?: string | null;
  priority?: boolean;
};

/** Photo tile with name, product count and optional tagline. Used by the brands and categories indexes. */
export function CollectionTile({ href, name, count, image, tagline, priority }: Props) {
  return (
    <Link
      href={href}
      data-stagger
      className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-tile)] border border-border bg-surface transition-colors hover:border-foreground/25"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-tile">
        {image && (
          <Image
            src={image}
            alt=""
            fill
            sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw"
            priority={priority}
            className="object-cover transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.05]"
          />
        )}
      </div>
      <div className="flex flex-1 items-start justify-between gap-2 p-3 sm:gap-3 sm:p-4 md:p-5">
        <div className="min-w-0">
          <h3 className="font-display text-[0.82rem] leading-tight font-bold uppercase max-sm:[font-stretch:100%] sm:text-base md:text-lg">{name}</h3>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {count.toLocaleString("en-AU")} {count === 1 ? "product" : "products"}
          </p>
          {tagline && <p className="mt-2 line-clamp-2 hidden text-sm text-muted-foreground md:block">{tagline}</p>}
        </div>
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border sm:size-9 transition-all duration-500 ease-[var(--ease-out-expo)] group-hover:rotate-45 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
          <ArrowUpRightIcon weight="bold" className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}
