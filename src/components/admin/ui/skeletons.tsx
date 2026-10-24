import { cn } from "@/lib/utils";

const Bone = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded-xl bg-surface-2/70", className)} />;

/** Title, stat tiles, then a large list card: the shape of every admin list page. */
export function ListSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div aria-busy aria-label="Loading">
      <Bone className="h-8 w-48" />
      <Bone className="mt-3 h-4 w-72" />
      <div className={cn("mt-8 grid grid-cols-2 gap-3", tiles === 4 && "lg:grid-cols-4", tiles === 3 && "lg:grid-cols-3")}>
        {Array.from({ length: tiles }, (_, i) => (
          <Bone key={i} className="h-[4.75rem] rounded-2xl" />
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <Bone className="h-10 w-full max-w-md" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Bone key={i} className="h-14" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Two-column editor: main fields and a sidebar. */
export function EditorSkeleton() {
  return (
    <div aria-busy aria-label="Loading">
      <Bone className="h-8 w-64" />
      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Bone className="h-72 rounded-2xl" />
          <Bone className="h-56 rounded-2xl" />
        </div>
        <div className="space-y-6 lg:col-span-4">
          <Bone className="h-48 rounded-2xl" />
          <Bone className="h-64 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

/** Stand-in for the whole shell while the session is checked. */
export function ShellSkeleton() {
  return (
    <div className="min-h-dvh">
      <div className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-surface lg:block" />
      <div className="fixed inset-x-0 top-0 h-14 border-b border-border bg-surface lg:hidden" />
      <div className="px-4 pt-20 pb-10 sm:px-6 lg:pt-10 lg:pl-[calc(16rem+2.5rem)] lg:pr-10">
        <ListSkeleton />
      </div>
    </div>
  );
}
