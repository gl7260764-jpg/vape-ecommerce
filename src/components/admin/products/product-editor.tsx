"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowSquareOutIcon, FlagIcon, MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { createProduct, deleteProduct, updateProduct } from "@/app/actions/admin/products";
import { ImageManager } from "@/components/admin/products/image-manager";
import { HtmlField } from "@/components/admin/ui/html-field";
import { ConfirmDelete } from "@/components/admin/ui/confirm-delete";
import { CONTROL, Field, Select, Toggle } from "@/components/admin/ui/form";
import { BUTTON, Card, CardHeader } from "@/components/admin/ui/primitives";
import type { AdminProduct, ProductEditorOptions } from "@/lib/admin/queries/products";
import {
  centsToDollars,
  dollarsToCents,
  FLAVOUR_FAMILIES,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  productErrors,
  productSchema,
  STOCK_STATUSES,
  type ProductImageInput,
  type ProductInput,
} from "@/lib/admin/schemas/product";
import { slugify } from "@/lib/admin/slug";
import { cn } from "@/lib/utils";
import { productDescription, productTitle, type ProductSeoInput } from "@/lib/seo";
import { SITE_HOST } from "@/lib/site";

type FormState = {
  name: string;
  slug: string;
  type: ProductInput["type"];
  status: ProductInput["status"];
  stockStatus: ProductInput["stockStatus"];
  brandId: string;
  flavour: string;
  flavourFamily: string;
  puffs: string;
  volumeMl: string;
  nicotineMg: string;
  packSize: string;
  price: string;
  compareAt: string;
  sku: string;
  isFeatured: boolean;
  needsReview: boolean;
  shortDescription: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  categoryIds: string[];
  primaryCategoryId: string | null;
  images: ProductImageInput[];
};

const KIND_LABELS: Record<string, string> = { type: "Product types", brand: "Brands", series: "Series", collection: "Collections" };

function initialState(p?: AdminProduct): FormState {
  return {
    name: p?.name ?? "",
    slug: p?.slug ?? "",
    type: p?.type ?? "disposable",
    status: p?.status ?? "draft",
    stockStatus: p?.stockStatus ?? "in_stock",
    brandId: p?.brandId ?? "",
    flavour: p?.flavour ?? "",
    flavourFamily: p?.flavourFamily ?? "",
    puffs: p?.puffs?.toString() ?? "",
    volumeMl: p?.volumeMl?.toString() ?? "",
    nicotineMg: p?.nicotineMg?.toString() ?? "",
    packSize: String(p?.packSize ?? 1),
    price: p ? centsToDollars(p.priceCents) : "",
    compareAt: centsToDollars(p?.compareAtCents ?? null),
    sku: p?.sku ?? "",
    isFeatured: p?.isFeatured ?? false,
    needsReview: p?.needsReview ?? false,
    shortDescription: p?.shortDescription ?? "",
    description: p?.description ?? "",
    metaTitle: p?.metaTitle ?? "",
    metaDescription: p?.metaDescription ?? "",
    categoryIds: p?.categoryIds ?? [],
    primaryCategoryId: p?.primaryCategoryId ?? null,
    images: p?.images ?? [],
  };
}

/** Converts the text inputs to the action's input; reports fields that aren't numbers. */
function toInput(s: FormState): { input: ProductInput; numberErrors: Record<string, string> } {
  const numberErrors: Record<string, string> = {};
  const int = (key: string, v: string) => {
    if (!v.trim()) return null;
    if (!/^\d+$/.test(v.trim())) numberErrors[key] = "Enter a whole number";
    return Number.parseInt(v, 10);
  };
  const dec = (key: string, v: string) => {
    if (!v.trim()) return null;
    if (!/^\d+(\.\d{1,2})?$/.test(v.trim())) numberErrors[key] = "Enter a number, like 50 or 3.5";
    return Number(v);
  };
  const money = (key: string, v: string) => {
    if (v.trim() && !/^\$?\s*[\d,]+(\.\d{1,2})?$/.test(v.trim())) numberErrors[key] = "Enter an amount in dollars, like 44 or 44.95";
    return dollarsToCents(v);
  };
  const priceCents = money("priceCents", s.price);
  const input: ProductInput = {
    name: s.name,
    slug: s.slug,
    type: s.type,
    status: s.status,
    stockStatus: s.stockStatus,
    brandId: s.brandId || null,
    flavour: s.flavour,
    flavourFamily: (s.flavourFamily || null) as ProductInput["flavourFamily"],
    puffs: int("puffs", s.puffs),
    volumeMl: int("volumeMl", s.volumeMl),
    nicotineMg: dec("nicotineMg", s.nicotineMg),
    packSize: int("packSize", s.packSize) ?? 1,
    priceCents: priceCents ?? 0,
    compareAtCents: money("compareAtCents", s.compareAt),
    sku: s.sku,
    isFeatured: s.isFeatured,
    needsReview: s.needsReview,
    shortDescription: s.shortDescription,
    description: s.description,
    metaTitle: s.metaTitle,
    metaDescription: s.metaDescription,
    categoryIds: s.categoryIds,
    primaryCategoryId: s.primaryCategoryId,
    images: s.images,
  };
  if (priceCents === null && s.status === "active") numberErrors.priceCents = "Set a price before making the product live";
  return { input, numberErrors };
}

const FIELD_ORDER = ["name", "slug", "priceCents", "compareAtCents", "packSize", "type", "brandId", "puffs", "volumeMl", "nicotineMg", "categoryIds", "primaryCategoryId", "images", "metaTitle", "metaDescription"];

function CategoryPicker({
  options,
  selected,
  primary,
  error,
  onChange,
}: {
  options: ProductEditorOptions["categories"];
  selected: string[];
  primary: string | null;
  error?: string;
  onChange: (ids: string[], primary: string | null) => void;
}) {
  const [filter, setFilter] = useState("");
  const byId = useMemo(() => new Map(options.map((c) => [c.id, c])), [options]);
  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q ? options.filter((c) => c.name.toLowerCase().includes(q) || c.parent?.toLowerCase().includes(q)) : options;
    return Object.entries(KIND_LABELS)
      .map(([kind, label]) => ({ kind, label, items: list.filter((c) => c.kind === kind) }))
      .filter((g) => g.items.length);
  }, [options, filter]);

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      const next = selected.filter((x) => x !== id);
      onChange(next, primary === id ? (next[0] ?? null) : primary);
    } else {
      onChange([...selected, id], primary ?? id);
    }
  };

  return (
    <div>
      {selected.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-1.5">
          {selected.map((id) => {
            const c = byId.get(id);
            if (!c) return null;
            const isPrimary = primary === id;
            return (
              <li key={id} className={cn("inline-flex h-8 items-center gap-1 rounded-full border pr-1 pl-3 text-xs", isPrimary ? "border-primary bg-primary/10" : "border-border")}>
                <button type="button" onClick={() => onChange(selected, id)} title="Make this the main category" className="font-medium">
                  {c.name}
                  {isPrimary && <span className="ml-1.5 text-[0.65rem] tracking-wider text-primary-ink uppercase">Main</span>}
                </button>
                <button type="button" onClick={() => toggle(id)} aria-label={`Remove ${c.name}`} className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground">
                  <XIcon className="size-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a category" aria-label="Find a category" className={cn(CONTROL, "pl-9")} />
      </div>
      <div data-lenis-prevent className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-border">
        {groups.length === 0 && <p className="p-4 text-sm text-muted-foreground">No categories match.</p>}
        {groups.map((g) => (
          <fieldset key={g.kind} className="border-b border-border last:border-0">
            <legend className="sr-only">{g.label}</legend>
            <p className="sticky top-0 bg-surface px-3 pt-3 pb-1 text-[0.68rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">{g.label}</p>
            {g.items.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-surface-2/50">
                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} className="size-4 accent-[var(--primary)]" />
                <span className="min-w-0 flex-1 truncate">
                  {c.name}
                  {c.parent && <span className="text-muted-foreground"> · {c.parent}</span>}
                </span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-destructive">{error}</p>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">Tap a selected category to make it the main one (used for breadcrumbs).</p>
      )}
    </div>
  );
}

export function ProductEditor({ product, options, canDelete }: { product?: AdminProduct; options: ProductEditorOptions; canDelete: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() => initialState(product));
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((s) => {
      const next = { ...s, [key]: value };
      if (key === "name" && !slugTouched) next.slug = slugify(String(value));
      return next;
    });
    setDirty(true);
    setErrors((e) => (e[key as string] || (key === "name" && !slugTouched && e.slug) ? { ...e, [key]: "", ...(key === "name" && !slugTouched ? { slug: "" } : {}) } : e));
  };
  const text = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    update(key, e.target.value as never);
  const err = (key: string) => errors[key] || undefined;

  const focusFirstError = (errs: Record<string, string>) => {
    const key = FIELD_ORDER.find((k) => errs[k]) ?? Object.keys(errs).find((k) => errs[k]);
    if (!key) return;
    const el = formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(key)}, [data-field="${key}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el && "focus" in el) el.focus({ preventScroll: true });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { input, numberErrors } = toInput(state);
    const parsed = productSchema.safeParse(input);
    const clientErrors = { ...(parsed.success ? {} : productErrors(parsed.error)), ...numberErrors };
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      focusFirstError(clientErrors);
      toast.error("Some fields need attention.");
      return;
    }
    startTransition(async () => {
      const result = product ? await updateProduct(product.id, input) : await createProduct(input);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        if (result.fieldErrors) focusFirstError(result.fieldErrors);
        toast.error(result.error);
        return;
      }
      setDirty(false);
      toast.success(product ? "Changes saved" : `${state.name} created`);
      router.push("/admin/products");
      router.refresh();
    });
  };

  const type = state.type;
  const showPuffs = ["disposable", "pod_kit", "bundle", "other"].includes(type);
  const showVolume = ["e_liquid", "other", "bundle"].includes(type);
  const showNicotine = ["disposable", "e_liquid", "pod_kit", "nicotine_pouch", "bundle", "other"].includes(type);
  // The same title and description the product page will carry (src/lib/seo.ts).
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const brand = options.brands.find((b) => b.id === state.brandId);
  const primary = options.categories.find((c) => c.id === state.primaryCategoryId);
  const seo: ProductSeoInput = {
    name: state.name || "Product name",
    type: state.type,
    price: Number(state.price) || 0,
    brand: brand ? { slug: brand.slug, name: brand.name } : null,
    primary: primary ? { name: primary.name, kind: primary.kind } : null,
    puffs: num(state.puffs),
    volumeMl: num(state.volumeMl),
    nicotineMg: num(state.nicotineMg),
    packSize: Number(state.packSize) || 1,
    flavour: state.flavour || null,
    shortDescription: state.shortDescription || null,
    metaTitle: state.metaTitle || null,
    metaDescription: state.metaDescription || null,
  };
  const seoTitle = productTitle(seo);
  const seoDescription = productDescription(seo) ?? "A short description of the product appears here in Google.";

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          {product?.needsReview && state.needsReview && (
            <div className="flex gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              <FlagIcon weight="fill" className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Flagged for review during the import</p>
                {product.reviewNotes.length > 0 && (
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-muted-foreground">
                    {product.reviewNotes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                )}
                <button type="button" onClick={() => update("needsReview", false)} className="mt-3 font-medium text-primary-ink hover:underline">
                  Mark as reviewed
                </button>
              </div>
            </div>
          )}

          <Card>
            <CardHeader title="Basics" />
            <div className="grid gap-5 p-5">
              <Field id="name" label="Name" error={err("name")}>
                <input id="name" value={state.name} onChange={text("name")} aria-invalid={Boolean(err("name"))} className={CONTROL} placeholder="IGET Bar Plus 6000 Puffs - Grape Ice" />
              </Field>
              <Field id="slug" label="Web address" error={err("slug")} hint={state.slug ? `${SITE_HOST}/product/${state.slug}` : "Made from the name. You can change it."}>
                <div className="flex items-center rounded-xl border border-input bg-background/60 focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/40">
                  <span className="pl-3.5 text-sm whitespace-nowrap text-muted-foreground">/product/</span>
                  <input
                    id="slug"
                    value={state.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                    }}
                    onBlur={() => setState((s) => ({ ...s, slug: slugify(s.slug) }))}
                    aria-invalid={Boolean(err("slug"))}
                    className="h-10 w-full min-w-0 bg-transparent pr-3.5 text-sm outline-none"
                  />
                </div>
              </Field>
              <Field id="shortDescription" label="Short description" optional error={err("shortDescription")} hint="One or two lines shown near the price.">
                <textarea id="shortDescription" value={state.shortDescription} onChange={text("shortDescription")} rows={2} className={cn(CONTROL, "h-auto resize-y py-2.5")} />
              </Field>
              <HtmlField id="description" label="Description" value={state.description} onChange={(v) => update("description", v)} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Pricing" description="Type amounts in dollars. 1200 means $1,200.00." />
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <Field id="priceCents" label="Price" error={err("priceCents")}>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input id="priceCents" inputMode="decimal" value={state.price} onChange={text("price")} placeholder="0.00" aria-invalid={Boolean(err("priceCents"))} className={cn(CONTROL, "pl-7 font-mono")} />
                </div>
              </Field>
              <Field id="compareAtCents" label="Was price" optional error={err("compareAtCents")} hint="Only for a genuine sale. Shown struck out; ignored unless higher than the price.">
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input id="compareAtCents" inputMode="decimal" value={state.compareAt} onChange={text("compareAt")} placeholder="0.00" aria-invalid={Boolean(err("compareAtCents"))} className={cn(CONTROL, "pl-7 font-mono")} />
                </div>
              </Field>
              <Field id="packSize" label="Units per pack" error={err("packSize")} hint="1 for a single item; 10 for a 10-pack.">
                <input id="packSize" inputMode="numeric" value={state.packSize} onChange={text("packSize")} aria-invalid={Boolean(err("packSize"))} className={cn(CONTROL, "font-mono")} />
              </Field>
              <Field id="sku" label="SKU" optional error={err("sku")}>
                <input id="sku" value={state.sku} onChange={text("sku")} className={cn(CONTROL, "font-mono")} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Product details" description="Shown as spec tiles on the product page." />
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <Field id="type" label="Product type" error={err("type")}>
                <Select id="type" value={state.type} onChange={text("type")}>
                  {PRODUCT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="brandId" label="Brand" optional error={err("brandId")}>
                <Select id="brandId" value={state.brandId} onChange={text("brandId")}>
                  <option value="">No brand</option>
                  {options.brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="flavour" label="Flavour" optional error={err("flavour")} hint="Short name shown on product cards, like Grape Ice.">
                <input id="flavour" value={state.flavour} onChange={text("flavour")} className={CONTROL} />
              </Field>
              <Field id="flavourFamily" label="Flavour family" optional hint="Powers the flavour filter in the shop.">
                <Select id="flavourFamily" value={state.flavourFamily} onChange={text("flavourFamily")}>
                  <option value="">None</option>
                  {FLAVOUR_FAMILIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </Field>
              {showPuffs && (
                <Field id="puffs" label="Puffs" optional error={err("puffs")}>
                  <input id="puffs" inputMode="numeric" value={state.puffs} onChange={text("puffs")} aria-invalid={Boolean(err("puffs"))} className={cn(CONTROL, "font-mono")} placeholder="6000" />
                </Field>
              )}
              {showVolume && (
                <Field id="volumeMl" label="Volume (ml)" optional error={err("volumeMl")}>
                  <input id="volumeMl" inputMode="numeric" value={state.volumeMl} onChange={text("volumeMl")} aria-invalid={Boolean(err("volumeMl"))} className={cn(CONTROL, "font-mono")} placeholder="60" />
                </Field>
              )}
              {showNicotine && (
                <Field id="nicotineMg" label="Nicotine (mg/ml)" optional error={err("nicotineMg")}>
                  <input id="nicotineMg" inputMode="decimal" value={state.nicotineMg} onChange={text("nicotineMg")} aria-invalid={Boolean(err("nicotineMg"))} className={cn(CONTROL, "font-mono")} placeholder="50" />
                </Field>
              )}
            </div>
          </Card>

          <Card data-field="images">
            <CardHeader title="Photos" description={`${state.images.length} of 12`} />
            <div className="p-5">
              <ImageManager images={state.images} onChange={(images) => update("images", images)} productName={state.slug || state.name} />
              {err("images") && <p className="mt-2 text-xs text-destructive">{err("images")}</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Search engine listing" description="Leave blank to use a title and description written from the product's details." />
            <div className="grid gap-5 p-5">
              <div className="rounded-xl border border-border bg-background/60 p-4">
                <p className="truncate text-xs text-muted-foreground">{SITE_HOST} › product › {state.slug || "..."}</p>
                <p className="mt-1 line-clamp-1 text-base text-sky-700 dark:text-sky-300">{seoTitle}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{seoDescription}</p>
              </div>
              <Field id="metaTitle" label="Page title" optional error={err("metaTitle")} hint={`${state.metaTitle.length}/60 characters recommended`}>
                <input id="metaTitle" value={state.metaTitle} onChange={text("metaTitle")} placeholder={state.name} className={CONTROL} />
              </Field>
              <Field id="metaDescription" label="Meta description" optional error={err("metaDescription")} hint={`${state.metaDescription.length}/160 characters recommended`}>
                <textarea id="metaDescription" value={state.metaDescription} onChange={text("metaDescription")} rows={3} placeholder={state.shortDescription} className={cn(CONTROL, "h-auto resize-y py-2.5")} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-4">
          <Card>
            <CardHeader title="Visibility" />
            <div className="grid gap-5 p-5">
              <fieldset>
                <legend className="text-sm font-medium">Status</legend>
                <div className="mt-2 grid gap-2">
                  {PRODUCT_STATUSES.map((s) => (
                    <label
                      key={s.value}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                        state.status === s.value ? "border-primary bg-primary/[0.06]" : "border-border hover:border-foreground/30"
                      )}
                    >
                      <input type="radio" name="status" value={s.value} checked={state.status === s.value} onChange={() => update("status", s.value)} className="mt-0.5 size-4 accent-[var(--primary)]" />
                      <span>
                        <span className="block text-sm font-medium">{s.label}</span>
                        <span className="block text-xs text-muted-foreground">{s.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field id="stockStatus" label="Stock">
                <Select id="stockStatus" value={state.stockStatus} onChange={text("stockStatus")}>
                  {STOCK_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Toggle id="isFeatured" label="Featured" description="Listed first in the shop's Featured sort." checked={state.isFeatured} onChange={(v) => update("isFeatured", v)} />
              <Toggle id="needsReview" label="Needs review" description="Flag it for a second look. Doesn't affect the store." checked={state.needsReview} onChange={(v) => update("needsReview", v)} />
            </div>
          </Card>

          <Card data-field="categoryIds">
            <CardHeader title="Categories" description={`${state.categoryIds.length} selected`} />
            <div className="p-5">
              <CategoryPicker
                options={options.categories}
                selected={state.categoryIds}
                primary={state.primaryCategoryId}
                error={err("categoryIds") || err("primaryCategoryId")}
                onChange={(ids, primary) => {
                  update("categoryIds", ids);
                  update("primaryCategoryId", primary);
                }}
              />
            </div>
          </Card>

          {product && (
            <Card>
              <CardHeader title="About this product" />
              <dl className="grid gap-2 p-5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">In past orders</dt>
                  <dd className="font-mono tabular-nums">{product.orderCount}</dd>
                </div>
                {product.wooId && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Old store ID</dt>
                    <dd className="font-mono tabular-nums">{product.wooId}</dd>
                  </div>
                )}
              </dl>
              <div className="flex flex-wrap gap-2 border-t border-border p-5">
                {product.status === "active" && (
                  <a href={`/product/${product.slug}`} target="_blank" rel="noreferrer" className={BUTTON.secondary}>
                    <ArrowSquareOutIcon className="size-4" aria-hidden /> View in store
                  </a>
                )}
                {canDelete && (
                  <ConfirmDelete
                    name={product.name}
                    kind="product"
                    variant="button"
                    action={deleteProduct.bind(null, product.id)}
                    redirectTo="/admin/products"
                    note={product.orderCount > 0 ? "It appears in past orders, so it will be archived instead: hidden from the store, with order history kept." : undefined}
                  />
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-30 -mx-4 mt-8 border-t border-border bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-2xl lg:border lg:px-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {pending ? "Saving..." : dirty ? "Unsaved changes" : product ? "No changes yet" : "New product"}
          </p>
          <div className="flex gap-2">
            <Link href="/admin/products" className={BUTTON.secondary}>
              Cancel
            </Link>
            <button type="submit" disabled={pending} className={BUTTON.primary}>
              {pending ? "Saving..." : product ? "Save changes" : "Create product"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
