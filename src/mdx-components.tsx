import type { MDXComponents } from "mdx/types";
import { Children, isValidElement, type ReactNode } from "react";
import Link from "next/link";
import { BlogProducts } from "@/components/blog/blog-products";
import { Figure } from "@/components/blog/figure";
import { ShortAnswer } from "@/components/blog/short-answer";
import { headingId } from "@/lib/blog";

// How blog posts (src/content/blog/*.mdx) render: the store's type and colours for plain Markdown, plus the
// components a post can use without importing them: <ShortAnswer>, <Products> and <Figure>.

const textOf = (node: ReactNode): string =>
  Children.toArray(node)
    .map((n) => (typeof n === "string" || typeof n === "number" ? String(n) : isValidElement<{ children?: ReactNode }>(n) ? textOf(n.props.children) : ""))
    .join("");

const components: MDXComponents = {
  h2: ({ children }) => (
    <h2 id={headingId(textOf(children))} className="mt-14 scroll-mt-28 font-display text-2xl leading-[1] font-extrabold tracking-[-0.02em] uppercase md:text-3xl">
      {children}
    </h2>
  ),
  h3: ({ children }) => <h3 className="mt-8 text-lg font-semibold">{children}</h3>,
  p: ({ children }) => <p className="mt-5">{children}</p>,
  ul: ({ children }) => <ul className="mt-5 list-disc space-y-2 pl-6 marker:text-primary-ink">{children}</ul>,
  ol: ({ children }) => <ol className="mt-5 list-decimal space-y-2 pl-6 marker:font-semibold marker:text-primary-ink">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  a: ({ href = "", children }) =>
    href.startsWith("/") ? (
      <Link href={href} className="font-medium text-primary-ink underline underline-offset-4 hover:no-underline">
        {children}
      </Link>
    ) : (
      <a href={href} target="_blank" rel="noopener" className="font-medium text-primary-ink underline underline-offset-4 hover:no-underline">
        {children}
      </a>
    ),
  blockquote: ({ children }) => (
    <blockquote className="my-10 font-display text-2xl leading-tight font-bold text-foreground uppercase md:text-3xl [&>p]:mt-0">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[32rem] text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface-2 text-foreground">{children}</thead>,
  th: ({ children }) => <th className="px-4 py-3 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-t border-border px-4 py-3 align-top">{children}</td>,
  hr: () => <hr className="my-12 border-border" />,
  ShortAnswer,
  Products: BlogProducts,
  Figure,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
