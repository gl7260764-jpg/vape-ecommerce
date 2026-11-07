import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleToc } from "@/components/blog/article-toc";
import { PostCard } from "@/components/blog/post-card";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { POSTS } from "@/content/blog/posts";
import { blogCategory, postDate, relatedPosts } from "@/lib/blog";
import { jsonLd, pageMetadata, SITE_NAME } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

const findPost = (slug: string) => POSTS.find((p) => p.slug === slug);

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = findPost((await params).slug);
  if (!post) return {};
  const meta = pageMetadata({ title: { absolute: post.seoTitle ?? post.title }, description: post.description, path: `/blog/${post.slug}`, image: post.cover.src });
  return {
    ...meta,
    openGraph: { ...meta.openGraph, type: "article", publishedTime: post.published, modifiedTime: post.updated ?? post.published },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = findPost(slug);
  if (!post) notFound();
  const { default: Body } = await import(`@/content/blog/${post.slug}.mdx`);
  const category = blogCategory(post.category)!;
  const url = `${SITE_URL}/blog/${post.slug}`;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#post`,
        headline: post.title,
        description: post.description,
        image: `${SITE_URL}${post.cover.src}`,
        datePublished: post.published,
        dateModified: post.updated ?? post.published,
        mainEntityOfPage: url,
        articleSection: category.name,
        keywords: post.keywords.join(", "),
        inLanguage: "en-AU",
        author: { "@type": "Organization", name: `${SITE_NAME} team`, url: `${SITE_URL}/about-us` },
        publisher: { "@id": `${SITE_URL}/#store` },
      },
      {
        "@type": "FAQPage",
        mainEntity: post.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };

  return (
    <>
      <article>
        <header className="mx-auto max-w-[1400px] px-4 pt-28 sm:px-6 md:pt-32 lg:px-10">
          <Breadcrumbs items={[{ label: "Blog", href: "/blog" }, { label: category.name, href: `/blog/category/${category.slug}` }, { label: post.title }]} />
          <div className="mt-8 max-w-[62rem]">
            <Link href={`/blog/category/${category.slug}`} className="text-sm font-semibold tracking-wide text-primary-ink uppercase hover:underline">
              {category.name}
            </Link>
            <h1 className="mt-3 font-display text-[clamp(2rem,5vw,4rem)] leading-[0.95] font-extrabold tracking-[-0.03em] text-balance uppercase">{post.title}</h1>
            <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-muted-foreground">{post.description}</p>
            <p className="mt-5 text-sm text-muted-foreground">
              {post.updated ? `Updated ${postDate(post.updated)}` : postDate(post.published)} · {post.readMinutes} min read · By the {SITE_NAME} team
            </p>
          </div>
          <Image
            src={post.cover.src}
            alt={post.cover.alt}
            width={1200}
            height={630}
            loading="eager"
            fetchPriority="high"
            sizes="(min-width: 1400px) 1320px, 100vw"
            className="mt-10 w-full rounded-[var(--radius-tile)] bg-tile"
          />
        </header>

        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-8 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-12 lg:gap-10 lg:px-10">
          <aside className="lg:order-2 lg:col-span-3 lg:col-start-10">
            <ArticleToc />
          </aside>
          <div data-article-body className="min-w-0 text-[1.0625rem] leading-[1.75] text-foreground/85 lg:col-span-8">
            <Body />

            <h2 id="faqs" className="mt-16 scroll-mt-28 font-display text-2xl leading-[1] font-extrabold tracking-[-0.02em] text-foreground uppercase md:text-3xl">
              FAQs
            </h2>
            <div className="mt-6 divide-y divide-border border-y border-border">
              {post.faq.map((f) => (
                <div key={f.q} className="py-5">
                  <h3 className="font-semibold text-foreground">{f.q}</h3>
                  <p className="mt-2">{f.a}</p>
                </div>
              ))}
            </div>

            <p className="mt-10 text-sm text-muted-foreground">
              <strong className="font-semibold text-foreground">Good to know:</strong> this guide is general information, not legal or medical advice. Prices
              are from the date above; product pages show today&apos;s. We only sell to adults aged 18 and over.
            </p>
          </div>
        </div>
      </article>

      <section aria-labelledby="keep-reading" className="border-t border-border">
        <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 md:py-20 lg:px-10">
          <h2 id="keep-reading" className="font-display text-3xl leading-[0.95] font-extrabold tracking-[-0.03em] uppercase">
            Keep reading
          </h2>
          {relatedPosts(POSTS, post).length > 0 ? (
            <div className="mt-8 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {relatedPosts(POSTS, post).map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-muted-foreground">
              More guides are on the way. <Link href="/blog" className="font-medium text-primary-ink hover:underline">See the blog</Link>.
            </p>
          )}
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
    </>
  );
}
