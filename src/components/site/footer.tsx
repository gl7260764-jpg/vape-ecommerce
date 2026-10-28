import Link from "next/link";
import { FacebookLogoIcon, InstagramLogoIcon, XLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/site/logo";
import { NewsletterForm } from "@/components/site/newsletter-form";

const columns = [
  {
    title: "Shop",
    links: [
      { label: "All products", href: "/shop" },
      { label: "Categories", href: "/categories" },
      { label: "Brands", href: "/brands" },
      { label: "IGET Bulk Buy", href: "/product-category/iget-vapes-bulk-buy" },
      { label: "Alibarbar Pandora", href: "/product-category/alibarbar-pandora" },
      { label: "Budget Vapes", href: "/budget-friendly" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Your account", href: "/account" },
      { label: "Shipping", href: "/shipping" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Company",
    // Returns, Services and News come back once they have pages (the old store's links went nowhere).
    links: [{ label: "About us", href: "/about-us" }],
  },
];

const socials = [
  { label: "Facebook", href: "#", icon: FacebookLogoIcon },
  { label: "Instagram", href: "#", icon: InstagramLogoIcon },
  { label: "X", href: "#", icon: XLogoIcon },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-border bg-surface">
      <div className="mx-auto max-w-[1400px] px-4 pt-20 sm:px-6 md:pt-28 lg:px-10">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <h2 className="font-display text-3xl leading-[0.95] font-extrabold tracking-[-0.03em] uppercase md:text-5xl">
              New flavours land here first
            </h2>
            <div className="mt-8">
              <NewsletterForm />
            </div>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-6 lg:col-start-7">
            {columns.map((col) => (
              <div key={col.title}>
                <h3 className="text-sm font-medium text-muted-foreground">{col.title}</h3>
                <ul className="mt-5 space-y-3">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-foreground/85 transition-colors hover:text-primary-ink">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-20 flex flex-col gap-6 border-t border-border py-8 md:flex-row md:items-center md:justify-between">
          <Logo />
          <ul className="flex gap-2">
            {socials.map(({ label, href, icon: Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  aria-label={label}
                  className="grid size-10 place-items-center rounded-full border border-border text-foreground/80 transition-colors hover:border-primary hover:text-primary-ink"
                >
                  <Icon className="size-[1.1rem]" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2 border-t border-border py-8 text-sm text-muted-foreground">
          <p className="font-medium text-foreground/85">
            Warning: this product contains nicotine. Nicotine is a highly addictive substance. Adults 18+ only.
          </p>
          <p>&copy; 2026 Best Vape Shop Australia. All rights reserved.</p>
        </div>
      </div>

      <p
        aria-hidden
        className="pointer-events-none -mb-[0.16em] text-center font-display text-[11.5vw] leading-[0.8] font-black tracking-[-0.05em] whitespace-nowrap text-foreground/[0.05] uppercase select-none"
      >
        Best Vape
      </p>
    </footer>
  );
}
