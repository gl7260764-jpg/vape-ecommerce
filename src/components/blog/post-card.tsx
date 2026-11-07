import Image from "next/image";
import Link from "next/link";
import { blogCategory, postDate, type BlogPost } from "@/lib/blog";
import { cn } from "@/lib/utils";

/**
 * A post in a list: cover, category, title, summary, date and read time. `featured` is the big one up top;
 * `priority` loads its cover first (the page's largest image).
 */
export function PostCard({ post, featured = false, priority = false }: { post: BlogPost; featured?: boolean; priority?: boolean }) {
  const href = `/blog/${post.slug}`;
  return (
    <article className={cn("group flex flex-col", featured && "lg:grid lg:grid-cols-12 lg:items-center lg:gap-10")}>
      <Link href={href} tabIndex={-1} aria-hidden className={cn("relative block overflow-hidden rounded-[var(--radius-tile)] bg-tile", featured && "lg:col-span-7")}>
        <Image
          src={post.cover.src}
          alt=""
          width={1200}
          height={630}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          sizes={featured ? "(min-width: 1024px) 760px, 100vw" : "(min-width: 1024px) 420px, (min-width: 640px) 46vw, 100vw"}
          className="aspect-[1200/630] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </Link>
      <div className={cn("mt-4 flex flex-col", featured && "lg:col-span-5 lg:mt-0")}>
        <p className="text-xs font-semibold tracking-wide text-primary-ink uppercase">{blogCategory(post.category)?.name}</p>
        <h3 className={cn("mt-2 font-semibold text-balance", featured ? "font-display text-2xl leading-[1.05] uppercase md:text-4xl" : "text-lg leading-snug")}>
          <Link href={href} className="hover:text-primary-ink">
            {post.title}
          </Link>
        </h3>
        <p className={cn("mt-2 text-muted-foreground", featured ? "md:text-lg" : "line-clamp-2 text-sm")}>{post.description}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          {postDate(post.updated ?? post.published)} · {post.readMinutes} min read
        </p>
      </div>
    </article>
  );
}
