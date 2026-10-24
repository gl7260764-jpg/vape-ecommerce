import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductEditor } from "@/components/admin/products/product-editor";
import { PageHeader } from "@/components/admin/ui/primitives";
import { EditorSkeleton } from "@/components/admin/ui/skeletons";
import { can, requireAdminPage } from "@/lib/admin/auth";
import { productEditorOptions } from "@/lib/admin/queries/products";

export const metadata: Metadata = { title: "New product" };

async function NewProduct() {
  const admin = await requireAdminPage("catalog:write");
  const options = await productEditorOptions();
  return <ProductEditor options={options} canDelete={can(admin.role, "catalog:delete")} />;
}

export default function NewProductPage() {
  return (
    <>
      <PageHeader eyebrow="Products" title="New product" description="Starts as a draft. Switch it to Live when it's ready to sell." />
      <Suspense fallback={<EditorSkeleton />}>
        <NewProduct />
      </Suspense>
    </>
  );
}
