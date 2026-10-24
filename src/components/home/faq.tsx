import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Reveal } from "@/components/motion/reveal";

// Replaces the old keyword paragraphs with answers people search for (good for SEO too).
// DRAFT COPY: shipping and sourcing answers need the client's sign-off.
const faqs = [
  {
    q: "Which disposable vape lasts the longest?",
    a: "Puff count is the best guide. The Airmez Xbeats is rated for up to 40,000 puffs and the HQD Cuvie Slick for 20,000, while the IGET Bar is a compact 3,500.",
  },
  {
    q: "How does bulk buying work?",
    a: "Bulk packs bundle several bars of the same model, so the price of each bar drops. They suit anyone who already knows their favourite flavour.",
  },
  {
    q: "Do you ship Australia-wide?",
    a: "Yes. Orders ship with tracking to every state and territory, and you get a tracking link by email as soon as your parcel leaves.",
  },
  {
    q: "Are your vapes genuine?",
    a: "We stock IGET, Alibarbar, HQD, ACE and Airmez, and every device arrives factory sealed.",
  },
  {
    q: "Who can buy from this store?",
    a: "Adults 18 and over only. We confirm age at entry and may ask for ID on delivery.",
  },
];

export function Faq() {
  return (
    <section aria-labelledby="faq-title" className="border-t border-border">
      <Reveal className="mx-auto grid max-w-[1400px] grid-cols-1 gap-12 px-4 py-24 sm:px-6 md:py-32 lg:grid-cols-12 lg:gap-10 lg:px-10">
        <div data-stagger className="lg:sticky lg:top-28 lg:col-span-5 lg:self-start">
          <h2 id="faq-title" className="font-display text-4xl leading-[0.95] font-extrabold tracking-[-0.03em] uppercase md:text-5xl">
            Buying vapes online in Australia
          </h2>
          <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-muted-foreground">
            Disposable vapes from the brands Australians trust, with bulk-buy pricing and tracked delivery. Here are the questions we hear most.
          </p>
        </div>
        <div data-stagger className="lg:col-span-7">
          <Accordion type="single" collapsible defaultValue="item-0" className="w-full">
            {faqs.map((item, i) => (
              <AccordionItem key={item.q} value={`item-${i}`} className="border-border">
                <AccordionTrigger className="py-6 text-left text-lg font-medium hover:no-underline md:text-xl">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="pb-6 text-base leading-relaxed text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Reveal>
    </section>
  );
}
