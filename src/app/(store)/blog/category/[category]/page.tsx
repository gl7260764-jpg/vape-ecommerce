import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/blog/post-card";
import { ListingHero } from "@/components/store/listing-hero";
import { POSTS } from "@/content/blog/posts";
import { BLOG_CATEGORIES, blogCategory, byNewest } from "@/lib/blog";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ category: string }> };

const postsIn = (slug: string) => POSTS.filter((p) => p.category === slug).sort(byNewest);

// A category shows up (here, on /blog and in the sitemap) once it has a post.
export function generateStaticParams() {
  return BLOG_CATEGORIES.filter((c) => postsIn(c.slug).length).map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = blogCategory((await params).category);
  if (!category || !postsIn(category.slug).length) return {};
  return pageMetadata({
    title: `${category.name} Guides`,
    description: `${category.description} Answers for Australians, updated for 2026.`,
    path: `/blog/category/${category.slug}`,
  });
}

export default async function BlogCategoryPage({ params }: Props) {
  const category = blogCategory((await params).category);
  const posts = category ? postsIn(category.slug) : [];
  if (!category || !posts.length) notFound();
  return (
    <>
      <ListingHero crumbs={[{ label: "Blog", href: "/blog" }, { label: category.name }]} title={category.name} tagline={category.description} />
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 md:py-20 lg:grid-cols-3 lg:px-10">
        {posts.map((p, i) => (
          <PostCard key={p.slug} post={p} priority={i === 0} />
        ))}
      </div>
    </>
  );
}
