import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import sharp from "sharp";
import { POSTS } from "@/content/blog/posts";
import { BLOG_CATEGORIES, byNewest, headingId, postWords, readMinutesFor, relatedPosts, type BlogPost } from "./blog";

// Every post's details against its MDX file and its pictures: what a new day's post must get right.
const mdx = (p: BlogPost) => readFileSync(`src/content/blog/${p.slug}.mdx`, "utf8");

test("every post has its MDX file, and every MDX file is listed", () => {
  const files = readdirSync("src/content/blog").filter((f) => f.endsWith(".mdx")).map((f) => f.replace(/\.mdx$/, ""));
  assert.deepEqual([...files].sort(), POSTS.map((p) => p.slug).sort());
  assert.equal(new Set(POSTS.map((p) => p.slug)).size, POSTS.length, "slugs are unique");
  for (const p of POSTS) assert.match(p.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, p.slug);
});

test("titles and descriptions fit in a search result and say where we are", () => {
  for (const p of POSTS) {
    const title = p.seoTitle ?? p.title;
    assert.ok(title.length <= 60, `${p.slug}: <title> is ${title.length} characters`);
    assert.ok(p.description.length >= 120 && p.description.length <= 160, `${p.slug}: description is ${p.description.length} characters`);
    assert.match(`${title} ${p.description}`, /australia/i, `${p.slug}: says Australia`);
    assert.ok(!p.description.toLowerCase().startsWith(p.title.split(/[:?]/)[0]!.toLowerCase()), `${p.slug}: description repeats the title`);
  }
  assert.equal(new Set(POSTS.map((p) => p.seoTitle ?? p.title)).size, POSTS.length, "no two posts share a title");
});

test("each post has a known category, real dates, the right read time and an FAQ", () => {
  const categories = new Set<string>(BLOG_CATEGORIES.map((c) => c.slug));
  for (const p of POSTS) {
    assert.ok(categories.has(p.category), `${p.slug}: ${p.category}`);
    for (const d of [p.published, p.updated].filter(Boolean) as string[]) assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)), `${p.slug}: ${d}`);
    assert.equal(p.readMinutes, readMinutesFor(mdx(p), p.faq), `${p.slug}: read time`);
    assert.ok(p.faq.length >= 4, `${p.slug}: at least 4 FAQs`);
    assert.ok(p.keywords.length >= 3, `${p.slug}: its keyword cluster`);
  }
  assert.deepEqual(POSTS.map((p) => p.slug), [...POSTS].sort(byNewest).map((p) => p.slug), "newest first");
});

test("each post answers first, has sections, and links to real posts", async () => {
  const slugs = new Set(POSTS.map((p) => p.slug));
  for (const p of POSTS) {
    const body = mdx(p);
    assert.ok(body.includes("<ShortAnswer>"), `${p.slug}: has a short answer`);
    assert.ok((body.match(/^## /gm) ?? []).length >= 3, `${p.slug}: at least three sections`);
    assert.ok(!/^# /m.test(body), `${p.slug}: no h1 in the body (the page has it)`);
    assert.ok(postWords(body) >= 600, `${p.slug}: ${postWords(body)} words`);
    for (const [, target] of body.matchAll(/\]\(\/blog\/([^)#]+)\)/g)) assert.ok(slugs.has(target!), `${p.slug}: links to /blog/${target}, which isn't published`);
    // THC and CBD products aren't shown anywhere on the blog.
    if (p.category === "cannabis") assert.ok(!body.includes("<Products"), `${p.slug}: a cannabis post shows products`);
  }
});

test("every cover is 1200x630 and every photo a post uses exists", async () => {
  for (const p of POSTS) {
    assert.equal(p.cover.src, `/blog/${p.slug}.jpg`);
    const { width, height } = await sharp(`public${p.cover.src}`).metadata();
    assert.deepEqual([width, height], [1200, 630], `${p.slug}: cover size`);
    assert.ok(p.cover.alt.length > 20, `${p.slug}: cover alt text`);
    for (const [, src] of mdx(p).matchAll(/src="(\/[^"]+)"/g)) assert.ok(existsSync(`public${src}`), `${p.slug}: ${src} is missing`);
  }
});

test("helpers: heading ids, word counts and related posts", () => {
  assert.equal(headingId("Battery or e-liquid: which runs out first?"), "battery-or-e-liquid-which-runs-out-first");
  assert.equal(headingId("Laws & Travel"), "laws-and-travel");
  assert.equal(headingId("What 6,000 puffs means in days"), "what-6000-puffs-means-in-days");
  assert.equal(postWords('Two words <Products slugs={["a", "b"]} /> [link](/x) here'), 4);
  const post = (slug: string, category: BlogPost["category"], published: string) => ({ slug, category, published }) as BlogPost;
  const all = [post("a", "education", "2026-11-01"), post("b", "comparisons", "2026-11-05"), post("c", "education", "2026-11-03"), post("d", "cannabis", "2026-11-04")];
  assert.deepEqual(relatedPosts(all, all[0]!).map((p) => p.slug), ["c", "b", "d"], "same category first, then newest");
});
