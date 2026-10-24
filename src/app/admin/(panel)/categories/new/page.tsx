import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryEditor } from "@/components/admin/taxonomy/category-editor";
import { PageHeader } from "@/components/admin/ui/primitives";
import { EditorSkeleton } from "@/components/admin/ui/skeletons";
import { can, requireAdminPage } from "@/lib/admin/auth";
import { categoryEditorOptions } from "@/lib/admin/queries/taxonomy";

export const metadata: Metadata = { title: "New category" };

async function NewCategory() {
  const admin = await requireAdminPage("catalog:write");
  const options = await categoryEditorOptions();
  return <CategoryEditor options={options} canDelete={can(admin.role, "catalog:delete")} />;
}

export default function NewCategoryPage() {
  return (
    <>
      <PageHeader eyebrow="Categories" title="New category" description="Then tick it on products in the product editor to fill it." />
      <Suspense fallback={<EditorSkeleton />}>
        <NewCategory />
      </Suspense>
    </>
  );
}
