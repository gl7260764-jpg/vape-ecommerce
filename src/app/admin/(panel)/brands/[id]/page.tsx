import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BrandEditor } from "@/components/admin/taxonomy/brand-editor";
import { PageHeader } from "@/components/admin/ui/primitives";
import { EditorSkeleton } from "@/components/admin/ui/skeletons";
import { can, requireAdminPage } from "@/lib/admin/auth";
import { formatDateTime } from "@/lib/admin/format";
import { getAdminBrand } from "@/lib/admin/queries/taxonomy";

export const metadata: Metadata = { title: "Edit brand" };

async function EditBrand({ params }: Pick<PageProps<"/admin/brands/[id]">, "params">) {
  const { id } = await params;
  const admin = await requireAdminPage("catalog:write");
  const brand = await getAdminBrand(id);
  if (!brand) notFound();
  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/admin/brands" className="hover:text-foreground">
            Brands
          </Link>
        }
        title={brand.name}
        description={`Last edited ${formatDateTime(brand.updatedAt)}`}
      />
      <BrandEditor brand={brand} canDelete={can(admin.role, "catalog:delete")} />
    </>
  );
}

export default function EditBrandPage({ params }: PageProps<"/admin/brands/[id]">) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditBrand params={params} />
    </Suspense>
  );
}
