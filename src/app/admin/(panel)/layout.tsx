import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminSidebar } from "@/components/admin/shell/sidebar";
import { ShellSkeleton } from "@/components/admin/ui/skeletons";
import { can, requireAdminPage, type Permission } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

const ALL_PERMISSIONS: Permission[] = ["catalog:write", "catalog:delete", "orders:write", "settings:write", "team:write", "people:manage"];

/** Authoritative page guard. Each loader and action still checks again (see ADMIN-BLUEPRINT.md). */
async function GuardedShell({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  const permissions = ALL_PERMISSIONS.filter((p) => can(admin.role, p));
  return (
    <div className="min-h-dvh bg-background">
      <AdminSidebar admin={{ name: admin.name, email: admin.email, role: admin.role, permissions }} />
      <div className="px-4 pt-20 pb-16 sm:px-6 lg:pt-10 lg:pr-10 lg:pl-[calc(16rem+2.5rem)]">
        <div className="mx-auto max-w-[1280px]">{children}</div>
      </div>
    </div>
  );
}

export default function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <GuardedShell>{children}</GuardedShell>
    </Suspense>
  );
}
