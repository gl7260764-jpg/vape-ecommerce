import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandEditor } from "@/components/admin/taxonomy/brand-editor";
import { PageHeader } from "@/components/admin/ui/primitives";
import { EditorSkeleton } from "@/components/admin/ui/skeletons";
import { can, requireAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "New brand" };

async function NewBrand() {
  const admin = await requireAdminPage("catalog:write");
  return <BrandEditor canDelete={can(admin.role, "catalog:delete")} />;
}

export default function NewBrandPage() {
  return (
    <>
      <PageHeader eyebrow="Brands" title="New brand" description="Pick it on products to group them under this brand." />
      <Suspense fallback={<EditorSkeleton />}>
        <NewBrand />
      </Suspense>
    </>
  );
}
