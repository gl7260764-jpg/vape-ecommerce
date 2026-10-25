"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { BellRingingIcon, PackageIcon } from "@phosphor-icons/react";
import { sendProductPush } from "@/app/actions/admin/push";
import { CONTROL, Field } from "@/components/admin/ui/form";
import { BUTTON } from "@/components/admin/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { PushProduct } from "@/lib/admin/queries/push";
import { formatPrice } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const STOCK: Record<PushProduct["stockStatus"], string> = { in_stock: "In stock", out_of_stock: "Out of stock", on_backorder: "On backorder" };
const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};
const devicesLabel = (n: number) => `${n} ${n === 1 ? "device" : "devices"}`;

/** The products to push, each with a Push button that opens the message box. */
export function ProductPushList({ products, devices, configured }: { products: PushProduct[]; devices: number; configured: boolean }) {
  const [product, setProduct] = useState<PushProduct | null>(null);
  return (
    <>
      <ul className="divide-y divide-border">
        {products.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3">
            <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-tile">
              {p.image ? <Image src={p.image} alt="" fill sizes="44px" className="object-contain p-1" /> : <PackageIcon className="size-5 text-muted-foreground" aria-hidden />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{p.name}</span>
              <span className="block text-xs text-muted-foreground">
                {formatPrice(p.priceCents / 100)} · {STOCK[p.stockStatus]}
                {p.lastPushedAt && ` · Sent ${ago(p.lastPushedAt)}`}
              </span>
            </span>
            <button type="button" onClick={() => setProduct(p)} aria-label={`Push ${p.name}`} className={cn(BUTTON.primary, "h-9 shrink-0 px-4")}>
              Push
            </button>
          </li>
        ))}
      </ul>
      {product && <PushDialog key={product.id} product={product} devices={devices} configured={configured} onClose={() => setProduct(null)} />}
    </>
  );
}

function PushDialog({ product, devices, configured, onClose }: { product: PushProduct; devices: number; configured: boolean; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(`Just in: ${product.name}`.slice(0, 60));
  const [body, setBody] = useState(`${formatPrice(product.priceCents / 100)}. Tap to see it.`);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const sending = useRef(false); // a double click must send once, before React re-renders the button

  const send = () => {
    if (sending.current) return;
    sending.current = true;
    startTransition(async () => {
      const result = await sendProductPush({ productId: product.id, title, body });
      sending.current = false;
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(`Sent to ${devicesLabel(result.data.sent)}`);
      onClose();
      router.refresh();
    });
  };

  return (
    // While sending, the box stays open: closing it and pressing Push again would send twice.
    <Dialog open onOpenChange={(open) => !open && !sending.current && onClose()}>
      <DialogContent showCloseButton={!pending} className="gap-0 p-0 sm:max-w-md">
        <div className="p-5">
          <DialogTitle className="text-base font-semibold">Push {product.name}</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Goes to {devicesLabel(devices)} with notifications on. Tapping it opens the product.
          </DialogDescription>
          <div className="mt-4 grid gap-4">
            <Field id="push-title" label="Title" error={errors.title}>
              <input id="push-title" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} className={CONTROL} aria-invalid={Boolean(errors.title)} />
            </Field>
            <Field id="push-body" label="Message" error={errors.body}>
              <input id="push-body" value={body} maxLength={160} onChange={(e) => setBody(e.target.value)} className={CONTROL} aria-invalid={Boolean(errors.body)} />
            </Field>
          </div>

          {/* How it lands on a phone (Android and Windows show the photo; iPhone and Mac show the icon only). */}
          <div data-testid="push-preview" className="mt-5 rounded-2xl bg-gradient-to-b from-zinc-800 to-zinc-950 p-3">
            <div className="rounded-xl bg-zinc-800/90 p-3 text-zinc-100">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-sm font-black text-primary-foreground">B</span>
                <div className="min-w-0 flex-1">
                  <p className="flex justify-between text-[10px] tracking-wide text-zinc-400 uppercase">
                    <span>Best Vape</span>
                    <span>now</span>
                  </p>
                  <p className="truncate text-sm font-semibold">{title || "Title"}</p>
                  <p className="line-clamp-2 text-sm text-zinc-300">{body || "Message"}</p>
                </div>
              </div>
              {product.image && (
                <div className="relative mt-3 aspect-[2/1] overflow-hidden rounded-lg bg-white">
                  <Image src={product.image} alt="" fill sizes="400px" className="object-contain p-2" />
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border p-4">
          <button type="button" onClick={send} disabled={pending || !configured || devices === 0} className={BUTTON.primary}>
            <BellRingingIcon className="size-4" aria-hidden />
            {pending ? "Sending..." : `Send to ${devicesLabel(devices)}`}
          </button>
          <button type="button" onClick={onClose} disabled={pending} className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50">
            Cancel
          </button>
          {!configured && <p className="w-full text-xs text-destructive">Notifications aren&apos;t set up yet: add the two VAPID settings.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
