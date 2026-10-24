import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CategoryEditor } from "@/components/admin/taxonomy/category-editor";
import { PageHeader, StatusPill } from "@/components/admin/ui/primitives";
import { EditorSkeleton } from "@/components/admin/ui/skeletons";
import { can, requireAdminPage } from "@/lib/admin/auth";
import { formatDateTime } from "@/lib/admin/format";
import { categoryEditorOptions, getAdminCategory } from "@/lib/admin/queries/taxonomy";

export const metadata: Metadata = { title: "Edit category" };

async function EditCategory({ params }: Pick<PageProps<"/admin/categories/[id]">, "params">) {
  const { id } = await params;
  const admin = await requireAdminPage("catalog:write");
  const [category, options] = await Promise.all([getAdminCategory(id), categoryEditorOptions()]);
  if (!category) notFound();
  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/admin/categories" className="hover:text-foreground">
            Categories
          </Link>
        }
        title={category.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill status={category.isVisible ? "visible" : "hidden"} />
            <span>Last edited {formatDateTime(category.updatedAt)}</span>
          </span>
        }
      />
      <CategoryEditor category={category} options={options} canDelete={can(admin.role, "catalog:delete")} />
    </>
  );
}

export default function EditCategoryPage({ params }: PageProps<"/admin/categories/[id]">) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditCategory params={params} />
    </Suspense>
  );
}
