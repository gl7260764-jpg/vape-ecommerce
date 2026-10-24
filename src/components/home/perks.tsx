import { ChatsCircleIcon, LockKeyIcon, SealCheckIcon, TruckIcon } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "@/components/motion/reveal";

// DRAFT COPY: confirm each promise with the client before launch.
const perks = [
  { icon: TruckIcon, title: "Australia-wide shipping", body: "Tracked delivery to every state and territory." },
  { icon: SealCheckIcon, title: "Genuine stock", body: "Sealed devices from the brands you know." },
  { icon: LockKeyIcon, title: "Secure checkout", body: "Encrypted payments on every order." },
  { icon: ChatsCircleIcon, title: "Real support", body: "Message us and a real person replies." },
];

export function Perks() {
  return (
    <section aria-label="Why shop with us" className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
      <Reveal className="grid grid-cols-1 overflow-hidden rounded-[var(--radius-tile)] border border-border sm:grid-cols-2 lg:grid-cols-4" stagger={0.1}>
        {perks.map(({ icon: Icon, title, body }, i) => (
          <div
            key={title}
            data-stagger
            className={[
              "flex gap-4 p-6 md:p-8",
              i > 0 ? "border-t border-border sm:border-t-0" : "",
              i % 2 === 1 ? "sm:border-l" : "",
              i >= 2 ? "sm:border-t lg:border-t-0" : "",
              i === 2 ? "lg:border-l" : "",
            ].join(" ")}
          >
            <Icon weight="duotone" className="size-7 shrink-0 text-primary-ink" />
            <div>
              <h3 className="font-medium">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          </div>
        ))}
      </Reveal>
    </section>
  );
}
