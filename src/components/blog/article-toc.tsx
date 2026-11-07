"use client";

import { useEffect, useState } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";

type Item = { id: string; text: string };

/**
 * "In this article": the post's h2s, read from the page once it loads, so a post never lists its sections
 * twice. Phones get it folded above the post; desktops get it in the sticky side column. Both shells render
 * on the server and only their lists fill in, so nothing moves.
 */
export function ArticleToc() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    const headings = [...document.querySelectorAll<HTMLHeadingElement>("[data-article-body] h2[id]")];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the headings are only readable after mount
    setItems(headings.map((h) => ({ id: h.id, text: h.textContent ?? "" })));
  }, []);

  const list = (
    <ol className="mt-3 space-y-2 text-sm">
      {items.map((i) => (
        <li key={i.id}>
          <a href={`#${i.id}`} className="text-muted-foreground transition-colors hover:text-foreground">
            {i.text}
          </a>
        </li>
      ))}
    </ol>
  );
  return (
    <>
      <details className="group rounded-2xl border border-border bg-surface px-5 py-4 lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between font-medium [&::-webkit-details-marker]:hidden">
          In this article
          <CaretDownIcon className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        {list}
      </details>
      <nav aria-label="In this article" className="sticky top-28 hidden lg:block">
        <p className="font-display text-sm font-bold tracking-wide uppercase">In this article</p>
        {list}
      </nav>
    </>
  );
}
