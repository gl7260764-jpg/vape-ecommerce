import type { BlogPost } from "@/lib/blog";

// Every published post, newest first. The body is src/content/blog/<slug>.mdx and the cover is
// public/blog/<slug>.jpg (scripts/blog/cover.mjs). How to add one: docs/blog/README.md.
export const POSTS: BlogPost[] = [
  {
    slug: "how-long-does-an-iget-bar-plus-last",
    title: "How Long Does an IGET Bar Plus Last? Puffs, Days and Pods (2026)",
    seoTitle: "How Long Does an IGET Bar Plus Last? (2026 Guide)",
    description:
      "Rated at 6,000 puffs a pod, an IGET Bar Plus lasts about 30 days at 200 puffs a day. Real numbers, Australian prices and tips to make each pod last.",
    category: "education",
    published: "2026-11-07",
    readMinutes: 6,
    cover: { src: "/blog/how-long-does-an-iget-bar-plus-last.jpg", alt: "An IGET Bar Plus disposable vape beside the headline How long does an IGET Bar Plus last?" },
    keywords: ["how long does an iget bar plus last", "how long does an iget bar last", "how many puffs in iget bar", "iget bar plus pods", "iget bar plus australia"],
    faq: [
      {
        q: "How many puffs does an IGET Bar Plus have?",
        a: "Each IGET Bar Plus pod is rated at 6,000 puffs. The battery is rechargeable and lasts across many pods, so you only replace the pod when the flavour runs out.",
      },
      {
        q: "How many days does an IGET Bar Plus last?",
        a: "About 30 days at 200 puffs a day. Light users get close to two months and heavy users around 12 days. Longer puffs use more liquid, so they shorten that.",
      },
      {
        q: "Is the IGET Bar Plus rechargeable?",
        a: "Yes. Recharge the battery when the vapour thins or the light flashes, and swap the pod when the flavour fades or tastes burnt even on a full charge.",
      },
      {
        q: "How long does an IGET Bar last compared with the Bar Plus?",
        a: "An IGET Bar (3,500 puffs) lasts about 17 days at 200 puffs a day, against about 30 days for a Bar Plus pod. The Bar is sealed, so it's finished when either its battery or its liquid runs out.",
      },
      {
        q: "How much does an IGET Bar Plus cost per day?",
        a: "A single pod is $29, so at 200 puffs a day that's about $1 a day. In a 5-pack, pods are $25 each, a little over 80 cents a day.",
      },
      {
        q: "Where can I buy IGET Bar Plus pods in Australia?",
        a: "We sell the Bar Plus, single pods and pod bundles online with tracked delivery to every state and territory. Regular shipping is free on orders from $500.",
      },
    ],
  },
  {
    slug: "iget-or-alibarbar-which-is-better",
    title: "IGET or Alibarbar: Which Is Better? Puffs, Flavours and Price Compared",
    seoTitle: "IGET or Alibarbar: Which Is Better? (2026 Australia)",
    description:
      "IGET has 120 flavours and an icy fruit style; Alibarbar has 25,000-puff Uploads at about $2 per 1,000 puffs. Puffs, flavours and Australian prices compared.",
    category: "comparisons",
    published: "2026-11-07",
    readMinutes: 5,
    cover: { src: "/blog/iget-or-alibarbar-which-is-better.jpg", alt: "An IGET One beside a box of Alibarbar Ingot disposables, with the headline IGET or Alibarbar: which is better?" },
    keywords: ["iget or alibarbar which is better", "alibarbar vs iget", "how many puffs is alibarbar", "alibarbar flavours", "iget flavours australia"],
    faq: [
      {
        q: "Is IGET or Alibarbar better?",
        a: "Neither is better for everyone. IGET has more flavours and sizes, with an icy fruit style; Alibarbar has sweeter flavours and the most puffs per dollar, especially the 25,000-puff Upload.",
      },
      {
        q: "How many puffs is an Alibarbar?",
        a: "It depends on the model: the Pandora is rated at 7,000 puffs, the Ingot at 9,000 and the Upload at 25,000.",
      },
      {
        q: "Which lasts longer, the IGET One or the Alibarbar Upload?",
        a: "The Upload. It's rated at 25,000 puffs against the IGET One's 12,000, roughly four months against two at 200 puffs a day.",
      },
      {
        q: "Which brand has more flavours?",
        a: "IGET, by a long way: 120 flavours across our IGET range, against 26 for Alibarbar.",
      },
      {
        q: "Is Alibarbar cheaper than IGET?",
        a: "Per puff, usually. An Alibarbar Upload works out at about $2 per 1,000 puffs and a Pandora at about $6, against $6.50 to $11 for IGET devices. IGET Bar Plus pods bought in a 5-pack come closest, at about $4.",
      },
      {
        q: "Can I order IGET and Alibarbar together?",
        a: "Yes. Mix any brands in one order. Orders from $500 get free regular shipping anywhere in Australia, and express drops to $30.",
      },
    ],
  },
];
