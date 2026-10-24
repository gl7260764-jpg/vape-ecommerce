import Link from "next/link";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";
import { BUTTON, EmptyState } from "@/components/admin/ui/primitives";

// A deleted or mistyped record inside the admin.
export default function AdminNotFound() {
  return (
    <EmptyState
      icon={MagnifyingGlassIcon}
      title="That record doesn't exist"
      description="It may have been deleted, or the link is incomplete."
      action={
        <Link href="/admin" className={BUTTON.secondary}>
          Back to the dashboard
        </Link>
      }
    />
  );
}
