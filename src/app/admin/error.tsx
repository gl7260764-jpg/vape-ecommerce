"use client";

import { AdminErrorState } from "@/components/admin/ui/error-state";

// Errors in the (panel) layout itself, such as the session check while the database wakes up.
export default function AdminRootError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-dvh px-4">
      <AdminErrorState {...props} />
    </main>
  );
}
