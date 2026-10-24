"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { createBrand, deleteBrand, updateBrand } from "@/app/actions/admin/taxonomy";
import { ConfirmDelete } from "@/components/admin/ui/confirm-delete";
import { CONTROL, Field } from "@/components/admin/ui/form";
import { BUTTON, Card, CardHeader } from "@/components/admin/ui/primitives";
import type { AdminBrand } from "@/lib/admin/queries/taxonomy";
import { brandSchema, fieldErrors } from "@/lib/admin/schemas/taxonomy";
import { slugify } from "@/lib/admin/slug";

export function BrandEditor({ brand, canDelete }: { brand?: AdminBrand; canDelete: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(brand?.name ?? "");
  const [slug, setSlug] = useState(brand?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(brand));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = { name, slug };
    const parsed = brandSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      toast.error("Some fields need attention.");
      return;
    }
    startTransition(async () => {
      const result = brand ? await updateBrand(brand.id, input) : await createBrand(input);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(brand ? "Changes saved" : `${name} created`);
      router.push("/admin/brands");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
      <Card className="lg:col-span-8">
        <CardHeader title="Brand" />
        <div className="grid gap-5 p-5">
          <Field id="name" label="Name" error={errors.name}>
            <input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
                setErrors((x) => ({ ...x, name: "", ...(slugTouched ? {} : { slug: "" }) }));
              }}
              aria-invalid={Boolean(errors.name)}
              className={CONTROL}
              placeholder="IGET"
            />
          </Field>
          <Field id="slug" label="Web address" error={errors.slug} hint={slug ? `bestvapeshopaustralia.com.au/brand/${slug}` : "Made from the name. You can change it."}>
            <div className="flex items-center rounded-xl border border-input bg-background/60 focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/40">
              <span className="pl-3.5 text-sm whitespace-nowrap text-muted-foreground">/brand/</span>
              <input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                  setErrors((x) => ({ ...x, slug: "" }));
                }}
                onBlur={() => setSlug((s) => slugify(s))}
                aria-invalid={Boolean(errors.slug)}
                className="h-10 w-full min-w-0 bg-transparent pr-3.5 text-sm outline-none"
              />
            </div>
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border p-5">
          <Link href="/admin/brands" className={BUTTON.secondary}>
            Cancel
          </Link>
          <button type="submit" disabled={pending} className={BUTTON.primary}>
            {pending ? "Saving..." : brand ? "Save changes" : "Create brand"}
          </button>
        </div>
      </Card>

      {brand && (
        <Card className="self-start lg:col-span-4">
          <CardHeader title="Uses" />
          <dl className="grid gap-2 p-5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Products</dt>
              <dd className="font-mono tabular-nums">{brand.products}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Ranges</dt>
              <dd className="text-right">{brand.categories.map((c) => c.name).join(", ") || "None"}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2 border-t border-border p-5">
            <Link href={`/admin/products?brand=${brand.slug}`} className={BUTTON.secondary}>
              See its products
            </Link>
            {brand.products > 0 && (
              <a href={`/brand/${brand.slug}`} target="_blank" rel="noreferrer" className={BUTTON.secondary}>
                <ArrowSquareOutIcon className="size-4" aria-hidden /> View
              </a>
            )}
            {canDelete && (
              <ConfirmDelete
                name={brand.name}
                kind="brand"
                variant="button"
                action={deleteBrand.bind(null, brand.id)}
                redirectTo="/admin/brands"
                note={brand.products ? "It still has products, so the delete will be refused until they're moved or deleted." : undefined}
              />
            )}
          </div>
        </Card>
      )}
    </form>
  );
}
