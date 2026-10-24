import { StarIcon } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "@/components/motion/reveal";

// PLACEHOLDER REVIEWS for the design pitch. Replace with real, verifiable customer
// reviews (for example a Google Business or Trustpilot feed) before this goes live.
const featured = {
  quote: "Ordered Monday, at my door Wednesday. Every bar sealed and exactly what I picked.",
  name: "Tahnee R.",
  place: "Gold Coast, QLD",
};

const more = [
  { quote: "Best price I found for the HQD Slick, and the flavour lasts the full run.", name: "Marcus O.", place: "Parramatta, NSW" },
  { quote: "Clean site, easy checkout and tracking the whole way. Already reordered.", name: "Priya S.", place: "Fremantle, WA" },
];

function Stars() {
  return (
    <div className="flex gap-1 text-primary-ink" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon key={i} weight="fill" className="size-4" />
      ))}
    </div>
  );
}

export function Reviews() {
  return (
    <section aria-labelledby="reviews-title" className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6 md:py-32 lg:px-10">
      <Reveal className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <figure
          data-stagger
          className="relative flex flex-col justify-between overflow-hidden rounded-[var(--radius-tile)] bg-primary p-8 text-primary-foreground md:p-12 lg:col-span-7 lg:min-h-[26rem]"
        >
          <h2 id="reviews-title" className="text-sm font-semibold">
            What customers say
          </h2>
          <blockquote className="mt-10 max-w-[24ch] font-display text-2xl leading-[1.12] font-bold tracking-[-0.01em] md:text-[2.15rem]">
            “{featured.quote}”
          </blockquote>
          <figcaption className="mt-10 flex items-center justify-between gap-4 text-sm">
            <span>
              <span className="font-semibold">{featured.name}</span>
              <span className="opacity-70"> - {featured.place}</span>
            </span>
            <span className="flex gap-1" aria-label="5 out of 5 stars">
              {Array.from({ length: 5 }).map((_, i) => (
                <StarIcon key={i} weight="fill" className="size-4" />
              ))}
            </span>
          </figcaption>
        </figure>

        <div className="grid gap-5 lg:col-span-5">
          {more.map((review) => (
            <figure
              key={review.name}
              data-stagger
              className="flex flex-col justify-between rounded-[var(--radius-tile)] border border-border bg-surface p-8"
            >
              <Stars />
              <blockquote className="mt-6 text-lg leading-relaxed text-foreground">“{review.quote}”</blockquote>
              <figcaption className="mt-6 text-sm">
                <span className="font-medium">{review.name}</span>
                <span className="text-muted-foreground"> - {review.place}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
