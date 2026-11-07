import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { PostCard } from "@/components/blog/post-card";
import { ListingHero } from "@/components/store/listing-hero";
import { POSTS } from "@/content/blog/posts";
import { BLOG_CATEGORIES, byNewest } from "@/lib/blog";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Vape Guides & Answers",
  description:
    "Straight answers to the questions Australians ask about disposables: how long they last, IGET vs Alibarbar, and what the law says in each state.",
  path: "/blog",
});

/** The blog: the newest post up top, then each category that has posts. */
export default function BlogPage() {
  const [featured, ...rest] = [...POSTS].sort(byNewest);
  const sections = BLOG_CATEGORIES.map((c) => ({ ...c, posts: rest.filter((p) => p.category === c.slug).slice(0, 3) })).filter((c) => c.posts.length);
  return (
    <>
      <ListingHero
        crumbs={[{ label: "Blog" }]}
        title="Guides & answers"
        tagline="Straight answers to the questions we get asked most: how long a disposable lasts, which brand to pick, and what the rules are where you live."
      />
      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 md:py-20 lg:px-10">
        {featured && <PostCard post={featured} featured priority />}
        {sections.map((s) => (
          <section key={s.slug} aria-labelledby={`blog-${s.slug}`} className="mt-20">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
              <div>
                <h2 id={`blog-${s.slug}`} className="font-display text-3xl leading-[0.95] font-extrabold tracking-[-0.03em] uppercase">
                  {s.name}
                </h2>
                <p className="mt-2 max-w-[60ch] text-muted-foreground">{s.description}</p>
              </div>
              <Link href={`/blog/category/${s.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-ink hover:underline">
                See all <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {s.posts.map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
