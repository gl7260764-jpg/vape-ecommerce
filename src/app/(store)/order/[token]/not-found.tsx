import Link from "next/link";
import { ReceiptXIcon } from "@phosphor-icons/react/dist/ssr";

// Rendered inside the store layout, so it uses a plain wrapper rather than another <main>.
export default function OrderNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-surface-2">
        <ReceiptXIcon className="size-7 text-muted-foreground" aria-hidden />
      </span>
      <h1 className="mt-6 font-display text-2xl font-bold uppercase md:text-3xl">We can&apos;t find that order</h1>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        Check the link is complete, or message us with your order number and we&apos;ll look it up for you.
      </p>
      <Link href="/shop" className="mt-8 inline-flex h-12 items-center rounded-full bg-primary px-7 font-semibold text-primary-foreground">
        Continue shopping
      </Link>
    </div>
  );
}
