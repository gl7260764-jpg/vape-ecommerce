import Link from "next/link";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/site/logo";

export default function NotFound() {
  return (
    <main className="grain relative grid min-h-[100dvh] place-items-center overflow-hidden px-4">
      <div aria-hidden className="absolute top-1/3 left-1/2 size-[30rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
      <div className="relative max-w-lg text-center">
        <Link href="/" className="inline-block">
          <Logo />
        </Link>
        <h1 className="mt-12 font-display text-4xl leading-[0.95] font-extrabold tracking-[-0.03em] uppercase md:text-6xl">
          This page is on its way
        </h1>
        <p className="mx-auto mt-6 max-w-[40ch] text-lg leading-relaxed text-muted-foreground">
          We&apos;re rebuilding the store one page at a time. Head back to the homepage to keep shopping.
        </p>
        <Link
          href="/"
          className="mt-10 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
        >
          <ArrowLeftIcon weight="bold" className="size-4" />
          Back to home
        </Link>
      </div>
    </main>
  );
}
