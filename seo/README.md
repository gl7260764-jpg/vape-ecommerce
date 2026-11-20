# Pages to submit to Google

[`urls.csv`](urls.csv) lists every page in the live sitemap (https://vapesupplieraustralia.com.au/sitemap.xml),
in the order worth asking Google to index them: home and main pages, the main shelves and the busiest
categories, blog posts, brands, then products. THC/CBD pages under legal review come last in each group.

| Column | Meaning |
| --- | --- |
| order | Work down from 1 |
| url | The page to submit |
| page_type | home, main page, category, blog post, blog category, brand, product, info page |
| name | What the page is |
| last_updated | When the page last changed (from the sitemap) |
| submitted | Put `yes` once you've requested indexing |
| submitted_date | The day you did |
| notes | Anything you want to remember |

## Submitting a page

1. Open Google Search Console, property **vapesupplieraustralia.com.au**.
2. Paste the `url` into the search bar at the top ("Inspect any URL") and press Enter.
3. Click **Request indexing** and wait for "Indexing requested".
4. Mark the row `yes` with today's date.

Google allows roughly 10 requests a day per site. The sitemap already tells Google about every page, so the
manual requests are for speeding up the important ones: the first ~85 rows (home, main pages, categories, blog,
brands) matter most.

## Keeping it up to date

After a change goes live (new products, categories or blog posts), regenerate the list:

```bash
npm run seo:urls
```

It reads the live sitemap, adds new pages in their place, drops pages that are gone, and **keeps your
`submitted` / `submitted_date` / `notes`**. It prints how many pages are new. Commit `seo/urls.csv` with the
change, and submit the new rows.
