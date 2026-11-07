import Image from "next/image";

/**
 * A photo inside a post (`<Figure src="/blog/x.jpg" alt="…" caption="…" credit="Jane Doe" creditUrl="…" />`),
 * 1200x800 in public/blog. Stock photos carry their photographer's credit.
 */
export function Figure({ src, alt, caption, credit, creditUrl }: { src: string; alt: string; caption?: string; credit?: string; creditUrl?: string }) {
  return (
    <figure className="my-10">
      <Image src={src} alt={alt} width={1200} height={800} sizes="(min-width: 1024px) 720px, 100vw" className="w-full rounded-[var(--radius-tile)] bg-tile" />
      {(caption || credit) && (
        <figcaption className="mt-3 text-sm text-muted-foreground">
          {caption}
          {credit && (
            <>
              {caption ? " " : ""}Photo:{" "}
              {creditUrl ? (
                <a href={creditUrl} target="_blank" rel="noopener" className="underline underline-offset-4 hover:text-foreground">
                  {credit}
                </a>
              ) : (
                credit
              )}
              .
            </>
          )}
        </figcaption>
      )}
    </figure>
  );
}
