import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductEditor } from "@/components/admin/products/product-editor";
import { PageHeader, StatusPill } from "@/components/admin/ui/primitives";
import { EditorSkeleton } from "@/components/admin/ui/skeletons";
import { can, requireAdminPage } from "@/lib/admin/auth";
import { formatDateTime } from "@/lib/admin/format";
import { getAdminProduct, productEditorOptions } from "@/lib/admin/queries/products";

export const metadata: Metadata = { title: "Edit product" };

async function EditProduct({ params }: Pick<PageProps<"/admin/products/[id]">, "params">) {
  const { id } = await params;
  const admin = await requireAdminPage("catalog:write");
  const [product, options] = await Promise.all([getAdminProduct(id), productEditorOptions()]);
  if (!product) notFound();
  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/admin/products" className="hover:text-foreground">
            Products
          </Link>
        }
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill status={product.status} />
            <span>Last edited {formatDateTime(product.updatedAt)}</span>
          </span>
        }
      />
      <ProductEditor product={product} options={options} canDelete={can(admin.role, "catalog:delete")} />
    </>
  );
}

export default function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditProduct params={params} />
    </Suspense>
  );
}
