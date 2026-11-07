import type { BlogPost } from "@/lib/blog";

// Every published post, newest first. The body is src/content/blog/<slug>.mdx and the cover is
// public/blog/<slug>.jpg (scripts/blog/cover.mjs). How to add one: docs/blog/README.md.
export const POSTS: BlogPost[] = [
  {
    slug: "can-i-bring-vapes-back-from-bali-to-australia",
    title: "Can I Bring Vapes Back From Bali to Australia? (2026 Rules)",
    description:
      "Each traveller can bring 2 vapes, 20 pods and 200 ml of liquid into Australia. What the limits cover, how to declare them and why posting vapes is banned.",
    category: "laws-and-travel",
    published: "2026-11-08",
    readMinutes: 5,
    cover: { src: "/blog/can-i-bring-vapes-back-from-bali-to-australia.jpg", alt: "Two IGET Legend disposables beside the headline Vapes from Bali: what's allowed?" },
    keywords: [
      "can i bring vapes back from bali to australia",
      "how many vapes can i bring back from bali",
      "bringing vapes from bali to australia",
      "can you bring vapes back from bali to perth",
      "can i bring vapes into australia",
    ],
    faq: [
      {
        q: "How many vapes can I bring back from Bali to Australia?",
        a: "Up to 2 vapes per person, plus 20 pods, cartridges or capsules and 200 ml of vape liquid, under the traveller exemption in regulation 5A of the Customs (Prohibited Imports) Regulations 1956, as of November 2026.",
      },
      {
        q: "Can I bring disposable vapes back from Bali?",
        a: "Yes, within the same limits. Disposables are covered by the traveller exemption, and each one counts as one of your two vapes.",
      },
      {
        q: "Do I have to declare vapes when I land in Australia?",
        a: "Declare them. Border Force lists vaping goods under medicines and substances, which question 1 on the Incoming Passenger Card asks about. Tick Yes and tell the officer how many you have.",
      },
      {
        q: "Can I post vapes from Bali to Australia?",
        a: "No. Importing vaping goods by post has been prohibited absolutely since 1 March 2024, and vapes that arrive in the post are seized. Carry them with you instead, within the limits.",
      },
      {
        q: "Can I pack vapes in my checked luggage?",
        a: "No. Qantas and Virgin Australia only allow vapes in carry-on baggage, and you can't use or charge them on board.",
      },
      {
        q: "Are the rules different if I fly into Perth?",
        a: "No. Customs rules are federal, so the same limits apply at every Australian airport. What you can do with vapes after you land is set by your state's law.",
      },
    ],
  },
  {
    slug: "how-to-tell-if-iget-is-fake",
    title: "How to Tell If Your IGET Bar Is Fake: 5 Checks That Work",
    description:
      "Photograph the orange code under the box at igetvape.com, then check the model and puffs. Five checks, from IGET itself, to spot a fake IGET in Australia.",
    category: "education",
    published: "2026-11-08",
    readMinutes: 6,
    cover: { src: "/blog/how-to-tell-if-iget-is-fake.jpg", alt: "IGET Moon and IGET Legend disposables beside the headline Is your IGET fake? 5 checks" },
    keywords: ["how to tell if iget is fake", "how to tell if iget bar is fake", "fake iget bar vs real", "iget verification code", "iget original australia"],
    faq: [
      {
        q: "How do I check if my IGET is real?",
        a: "Use the anti-counterfeit code on the bottom of the box. On IGET's verification page, igetvape.com/ProductVerificate.html, photograph the orange code, or on an older box scan the green QR code or enter the 18-digit number.",
      },
      {
        q: "Where is the code on an IGET box?",
        a: "On the bottom of the packaging. Current boxes have an orange code, which IGET calls the Orange Code or Earth Code. Older boxes have a green QR code and an 18-digit number.",
      },
      {
        q: "My IGET box has no QR code. Is it fake?",
        a: "Not for that reason. IGET's new packaging, announced in September 2026, drops the QR code and keeps only the orange code. Old and new boxes are both genuine and both on sale.",
      },
      {
        q: "What does \"checked over 3 times\" mean on an IGET check?",
        a: "It's the result IGET's check gives for a code that has already been checked more than three times. IGET treats that box as fake and asks you to email iget@igetvape.com to double-check.",
      },
      {
        q: "What is IGET's official website?",
        a: "igetvape.com. It's the address IGET prints on its packaging and gives in its notices, and it hosts the verification page. Plenty of shops use IGET in their web address; the check that counts is the one on igetvape.com.",
      },
      {
        q: "Which IGET models are real?",
        a: "IGET's site lists 47 products, including the Bar, Bar Plus, Bar Pro, Legend, Moon K5000, One, XXL, Goat, Flare B10000 and Halo KP3000. If the model on your box isn't on igetvape.com, don't trust it.",
      },
    ],
  },
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
