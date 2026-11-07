// The blog's shape, shared by its pages, the sitemap and the tests. Posts are MDX files in src/content/blog
// (the body) listed in src/content/blog/posts.ts (everything else); docs/blog/README.md is the how-to.

export const BLOG_CATEGORIES = [
  {
    slug: "education",
    name: "Education",
    description: "How long a disposable lasts, what the numbers on the box mean and how to fix one that's playing up.",
  },
  {
    slug: "comparisons",
    name: "Comparisons",
    description: "IGET, Alibarbar, HQD and Geek Bar side by side: puffs, flavours and price per puff.",
  },
  {
    slug: "laws-and-travel",
    name: "Laws & Travel",
    description: "What the rules say in each state and territory, and what you can take on a plane or bring home from a trip.",
  },
  {
    slug: "cannabis",
    name: "Cannabis",
    description: "The law on cannabis and CBD in each state, how medicinal cannabis is prescribed, and driving rules.",
  },
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];
export type BlogCategorySlug = BlogCategory["slug"];

export type BlogPost = {
  /** The address (/blog/<slug>) and the MDX file's name (src/content/blog/<slug>.mdx). */
  slug: string;
  /** The h1: the question as people ask it. */
  title: string;
  /** The <title> when the h1 is longer than Google shows (60 characters). */
  seoTitle?: string;
  /** Meta description and the card's summary, 120-160 characters. */
  description: string;
  category: BlogCategorySlug;
  /** YYYY-MM-DD. */
  published: string;
  updated?: string;
  /** Words / 230, rounded up (checked by src/lib/blog.test.ts). */
  readMinutes: number;
  /** 1200x630 in public/blog, also the link preview. */
  cover: { src: string; alt: string; credit?: { name: string; url: string } };
  /** The search phrases the post answers (docs/blog/backlog.md). Not shown; kept for planning. */
  keywords: string[];
  /** Shown after the post and sent to Google as FAQPage data. */
  faq: { q: string; a: string }[];
};

export const blogCategory = (slug: string) => BLOG_CATEGORIES.find((c) => c.slug === slug);

/** Newest first. */
export const byNewest = (a: BlogPost, b: BlogPost) => (a.published < b.published ? 1 : a.published > b.published ? -1 : a.slug.localeCompare(b.slug));

/** Up to `take` other posts: the same category first, then the newest. */
export function relatedPosts(posts: BlogPost[], post: BlogPost, take = 3) {
  const others = posts.filter((p) => p.slug !== post.slug).sort(byNewest);
  return [...others.filter((p) => p.category === post.category), ...others.filter((p) => p.category !== post.category)].slice(0, take);
}

/** "6 November 2026" */
export const postDate = (iso: string) =>
  new Date(`${iso}T00:00:00+10:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Sydney" });

/** The words a reader reads in an MDX post: components' props, link addresses and table rules don't count. */
export function postWords(mdx: string) {
  const text = mdx
    .replace(/<(Products|Figure)\b[\s\S]*?\/>/g, " ")
    .replace(/<\/?ShortAnswer>/g, " ")
    .replace(/\]\([^)]*\)/g, " ")
    .replace(/^\|?[\s|:-]+\|?$/gm, " ");
  return text.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
}

/** The post and its FAQ at 230 words a minute, rounded up. */
export const readMinutesFor = (mdx: string, faq: BlogPost["faq"]) =>
  Math.max(1, Math.ceil((postWords(mdx) + postWords(faq.map((f) => `${f.q} ${f.a}`).join(" "))) / 230));

/** Heading text -> the id its "In this article" link jumps to. */
export const headingId = (text: string) =>
  text
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1$2")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
