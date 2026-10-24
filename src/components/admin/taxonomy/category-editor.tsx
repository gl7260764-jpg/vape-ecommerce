"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { createCategory, deleteCategory, updateCategory } from "@/app/actions/admin/taxonomy";
import { ConfirmDelete } from "@/components/admin/ui/confirm-delete";
import { CONTROL, Field, Select, Toggle } from "@/components/admin/ui/form";
import { HtmlField } from "@/components/admin/ui/html-field";
import { BUTTON, Card, CardHeader } from "@/components/admin/ui/primitives";
import { SingleImage } from "@/components/admin/ui/single-image";
import type { AdminCategory, CategoryEditorOptions } from "@/lib/admin/queries/taxonomy";
import { CATEGORY_KINDS, categorySchema, fieldErrors, type CategoryInput } from "@/lib/admin/schemas/taxonomy";
import { slugify } from "@/lib/admin/slug";
import { cn } from "@/lib/utils";

type State = Omit<CategoryInput, "sortOrder" | "parentId" | "brandId" | "tagline" | "description" | "metaTitle" | "metaDescription"> & {
  sortOrder: string;
  parentId: string;
  brandId: string;
  tagline: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
};

export function CategoryEditor({ category, options, canDelete }: { category?: AdminCategory; options: CategoryEditorOptions; canDelete: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<State>(() => ({
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    kind: category?.kind ?? "type",
    tagline: category?.tagline ?? "",
    description: category?.description ?? "",
    parentId: category?.parentId ?? "",
    brandId: category?.brandId ?? "",
    isVisible: category?.isVisible ?? true,
    isFeatured: category?.isFeatured ?? false,
    sortOrder: String(category?.sortOrder ?? 0),
    imageKey: category?.imageKey ?? null,
    metaTitle: category?.metaTitle ?? "",
    metaDescription: category?.metaDescription ?? "",
  }));
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // A category can't sit under itself or anything below it.
  const parentOptions = useMemo(() => {
    if (!category) return options.categories;
    const blocked = new Set([category.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of options.categories) {
        if (c.parentId && blocked.has(c.parentId) && !blocked.has(c.id)) {
          blocked.add(c.id);
          grew = true;
        }
      }
    }
    return options.categories.filter((c) => !blocked.has(c.id));
  }, [category, options.categories]);

  const update = <K extends keyof State>(key: K, value: State[K]) => {
    setState((s) => ({ ...s, [key]: value, ...(key === "name" && !slugTouched ? { slug: slugify(String(value)) } : {}) }));
    setDirty(true);
    setErrors((e) => (e[key as string] || (key === "name" && !slugTouched && e.slug) ? { ...e, [key]: "", ...(key === "name" && !slugTouched ? { slug: "" } : {}) } : e));
  };
  const text = (key: keyof State) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => update(key, e.target.value as never);
  const err = (k: string) => errors[k] || undefined;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sort = state.sortOrder.trim();
    const input: CategoryInput = {
      ...state,
      parentId: state.parentId || null,
      brandId: state.brandId || null,
      sortOrder: /^-?\d+$/.test(sort) ? Number(sort) : Number.NaN,
    };
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      if (errs.sortOrder) errs.sortOrder = "Use a whole number, like 0 or 10";
      setErrors(errs);
      document.getElementById(Object.keys(errs)[0])?.focus();
      toast.error("Some fields need attention.");
      return;
    }
    startTransition(async () => {
      const result = category ? await updateCategory(category.id, input) : await createCategory(input);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setDirty(false);
      toast.success(category ? "Changes saved" : `${state.name} created`);
      router.push("/admin/categories");
      router.refresh();
    });
  };

  const showBrand = state.kind === "brand" || state.kind === "series";

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          <Card>
            <CardHeader title="Basics" />
            <div className="grid gap-5 p-5">
              <Field id="name" label="Name" error={err("name")}>
                <input id="name" value={state.name} onChange={text("name")} aria-invalid={Boolean(err("name"))} className={CONTROL} placeholder="IGET Bar Plus" />
              </Field>
              <Field id="slug" label="Web address" error={err("slug")} hint={state.slug ? `bestvapeshopaustralia.com.au/product-category/${state.slug}` : "Made from the name. You can change it."}>
                <div className="flex items-center rounded-xl border border-input bg-background/60 focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/40">
                  <span className="pl-3.5 text-sm whitespace-nowrap text-muted-foreground">/product-category/</span>
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
              <fieldset>
                <legend className="text-sm font-medium">Kind</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {CATEGORY_KINDS.map((k) => (
                    <label
                      key={k.value}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                        state.kind === k.value ? "border-primary bg-primary/[0.06]" : "border-border hover:border-foreground/30"
                      )}
                    >
                      <input type="radio" name="kind" checked={state.kind === k.value} onChange={() => update("kind", k.value)} className="mt-0.5 size-4 accent-[var(--primary)]" />
                      <span>
                        <span className="block text-sm font-medium">{k.label}</span>
                        <span className="block text-xs text-muted-foreground">{k.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="parentId" label="Inside" optional error={err("parentId")} hint="Its products also appear on the parent's page.">
                  <Select id="parentId" value={state.parentId} onChange={text("parentId")}>
                    <option value="">Top level</option>
                    {parentOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                {showBrand && (
                  <Field id="brandId" label="Brand" optional error={err("brandId")} hint="Lists this range on the brand's page.">
                    <Select id="brandId" value={state.brandId} onChange={text("brandId")}>
                      <option value="">No brand</option>
                      {options.brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </div>
              <Field id="tagline" label="Tagline" optional error={err("tagline")} hint="One short line shown on category cards.">
                <input id="tagline" value={state.tagline} onChange={text("tagline")} className={CONTROL} />
              </Field>
              <HtmlField id="description" label="Description" value={state.description} onChange={(v) => update("description", v)} rows={8} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Search engine listing" description="Leave blank to use the name and tagline." />
            <div className="grid gap-5 p-5">
              <Field id="metaTitle" label="Page title" optional error={err("metaTitle")} hint={`${state.metaTitle.length}/60 characters recommended`}>
                <input id="metaTitle" value={state.metaTitle} onChange={text("metaTitle")} placeholder={state.name} className={CONTROL} />
              </Field>
              <Field id="metaDescription" label="Meta description" optional error={err("metaDescription")} hint={`${state.metaDescription.length}/160 characters recommended`}>
                <textarea id="metaDescription" value={state.metaDescription} onChange={text("metaDescription")} rows={3} placeholder={state.tagline} className={cn(CONTROL, "h-auto resize-y py-2.5")} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-4">
          <Card>
            <CardHeader title="Visibility" />
            <div className="grid gap-5 p-5">
              <Toggle id="isVisible" label="Show in the store" description="Hidden categories disappear from menus and pages. Their products stay live." checked={state.isVisible} onChange={(v) => update("isVisible", v)} />
              <Toggle id="isFeatured" label="Feature on the homepage" description="Adds it to the Shop by category grid." checked={state.isFeatured} onChange={(v) => update("isFeatured", v)} />
              <Field id="sortOrder" label="Order" error={err("sortOrder")} hint="Lower numbers show first.">
                <input id="sortOrder" inputMode="numeric" value={state.sortOrder} onChange={text("sortOrder")} aria-invalid={Boolean(err("sortOrder"))} className={cn(CONTROL, "font-mono")} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Image" description="Shown on category cards and the category page." />
            <div className="p-5">
              <SingleImage value={state.imageKey} onChange={(key) => update("imageKey", key)} name={state.slug || state.name} folder="categories" />
              {err("imageKey") && <p className="mt-2 text-xs text-destructive">{err("imageKey")}</p>}
            </div>
          </Card>

          {category && (
            <Card>
              <CardHeader title="In this category" />
              <dl className="grid gap-2 p-5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Products</dt>
                  <dd className="font-mono tabular-nums">{category.products}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Sub-categories</dt>
                  <dd className="font-mono tabular-nums">{category.children}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2 border-t border-border p-5">
                {category.isVisible && (
                  <a href={`/product-category/${category.slug}`} target="_blank" rel="noreferrer" className={BUTTON.secondary}>
                    <ArrowSquareOutIcon className="size-4" aria-hidden /> View in store
                  </a>
                )}
                {canDelete && (
                  <ConfirmDelete
                    name={category.name}
                    kind="category"
                    variant="button"
                    action={deleteCategory.bind(null, category.id)}
                    redirectTo="/admin/categories"
                    note={category.products || category.children ? "It still has products or sub-categories, so the delete will be refused until they're moved." : undefined}
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
            {pending ? "Saving..." : dirty ? "Unsaved changes" : category ? "No changes yet" : "New category"}
          </p>
          <div className="flex gap-2">
            <Link href="/admin/categories" className={BUTTON.secondary}>
              Cancel
            </Link>
            <button type="submit" disabled={pending} className={BUTTON.primary}>
              {pending ? "Saving..." : category ? "Save changes" : "Create category"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
