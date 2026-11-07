# The blog: publishing a post

Two posts a day, taken from the top of [backlog.md](backlog.md). Each post answers one question Australians
actually type into Google, in the pattern below. A post is two things in the code: its text in
`src/content/blog/<slug>.mdx` and its details in `src/content/blog/posts.ts`.

## The pattern (every post)

1. **The first paragraph answers the question.** No warm-up. Someone who reads only that should have the answer.
2. **`<ShortAnswer>`**: the answer again in 2–3 sentences or bullets, with the numbers in bold.
3. **4–6 sections (`##`)**, phrased the way people ask ("Battery or e-liquid: which runs out first?"). They become
   the "In this article" links. No `#` heading: the page prints the title as the h1.
4. **At least one table or list** with real numbers: puffs, prices, days.
5. **`<Products slugs={[...]} />`** once or twice: 3–6 picks from the store, shown with live prices and Add to cart.
6. **Links inside the text**: to the category pages for every range mentioned (`/product-category/iget-bar-plus`),
   to `/shipping` where delivery comes up, and to at least one other post.
7. **A photo** (`<Figure>`) where it helps explain something, plus the cover.
8. **6 FAQs** in `posts.ts`. The page shows them after the post and sends them to Google.
9. **750–1,200 words** of post, plus the FAQ.

## Rules

- **Never link to or show THC or CBD products** (Muha Meds, Ace, Supreme CBD) or bongs, in any post. Cannabis posts
  are information only: the law, how prescriptions work, driving. The `<Products>` block refuses those products
  anyway, and the tests fail if a cannabis post includes one.
- **Law and travel posts cite the official source** (TGA, Australian Border Force, the state health department or
  the legislation itself) as a link, say "as of <month year>", and state what the law actually says, even when
  that's inconvenient for a vape shop.
- **No health claims**: not "safer than smoking", not "helps you quit". Those are therapeutic claims.
- **Prices**: say "our prices in <month year>". The product cards always show today's price.
- **Only use facts you can check**: the store's own data (below), the manufacturer, or an official source. Spec
  sites for vapes contradict each other; leave a number out rather than guess it.
- **Product picks**: use addresses that won't change. Check a pick isn't on the clean-up list:
  `node --env-file=.env.local --conditions=react-server --import tsx scripts/catalog/clean-slugs.mts | grep <slug>`
  (no output = safe).
- Adults 18+. The page adds the "general information, not advice" note itself.

## Step by step

1. **Pick the next two posts** from [backlog.md](backlog.md) and check the phrases still autocomplete in Australia:
   `curl -s "https://suggestqueries.google.com/complete/search?client=firefox&hl=en-AU&gl=au&q=how+long+does+an+iget"`
2. **Get the store's numbers** (prices, puffs, flavour counts) with a throwaway script against the database, like
   `scripts/catalog/clean-slugs.mts` does (`node --env-file=.env.local --conditions=react-server --import tsx …`).
3. **Write** `src/content/blog/<slug>.mdx`. The slug is the question, lower case with dashes.
4. **Add the post to the top of `POSTS`** in `src/content/blog/posts.ts`:
   - `title`: the question as people ask it (the h1); `seoTitle` if the title is over 60 characters.
   - `description`: 120–160 characters, mentions Australia, doesn't start by repeating the title.
   - `category`: `education`, `comparisons`, `laws-and-travel` or `cannabis`.
   - `published`: today's date, `YYYY-MM-DD`. Add `updated` when you revise a post later.
   - `keywords`: the phrase cluster from the backlog.
   - `faq`: 6 questions with short answers.
   - `readMinutes`: run the tests in step 7; they tell you the right number.
5. **Make the cover** (1200x630, also the link preview):
   `node scripts/blog/cover.mjs <slug> "Education · 2026 guide" "Short headline?" products/<key>.webp`
   For comparisons add a second photo and `--vs`. Cut-out product photos work best: find keys in the
   database (`ProductImage.key`, `hasBackground: false`).
6. **Inline photos** (optional): free photos from unsplash.com only, not "Unsplash+". Save 1200x800 to
   `public/blog/<slug>-<what>.jpg` and use
   `<Figure src="/blog/<slug>-<what>.jpg" alt="…" caption="…" credit="Name on Unsplash" creditUrl="https://unsplash.com/photos/…" />`.
7. **Check**: `node --conditions=react-server --import tsx --test src/lib/blog.test.ts` (titles, descriptions,
   read time, covers, links between posts), then `npm run build`, `npx next start -p 3100` and
   `node e2e/e2e-blog.mjs http://localhost:3100` (every link in every post works, product picks show, phones fit).
8. **Commit, push, check the deploy**, then mark the posts done in [backlog.md](backlog.md).

## Where things are

| What | Where |
| --- | --- |
| Post text | `src/content/blog/<slug>.mdx` |
| Post details, FAQ, dates | `src/content/blog/posts.ts` |
| Categories | `BLOG_CATEGORIES` in `src/lib/blog.ts` |
| How Markdown looks, `<ShortAnswer>`, `<Products>`, `<Figure>` | `src/mdx-components.tsx`, `src/components/blog/` |
| Pages | `src/app/(store)/blog/` |
| Covers and photos | `public/blog/` |
| Tests | `src/lib/blog.test.ts`, `e2e/e2e-blog.mjs` |
