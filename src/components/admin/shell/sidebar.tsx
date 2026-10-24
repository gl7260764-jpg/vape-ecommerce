"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowSquareOutIcon, ListIcon, SignOutIcon } from "@phosphor-icons/react";
import { signOut } from "@/app/actions/admin/auth";
import { ChatBadge, ChatWatcher } from "@/components/admin/chat/chat-badge";
import { Logo } from "@/components/site/logo";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { NAV_GROUPS, activeHref } from "@/components/admin/shell/nav";
import type { Admin, Permission } from "@/lib/admin/auth";
import { cn } from "@/lib/utils";

type ShellAdmin = Pick<Admin, "name" | "email" | "role"> & { permissions: Permission[] };

function SidebarBody({ admin, onNavigate }: { admin: ShellAdmin; onNavigate?: () => void }) {
  // usePathname is available during SSR, so the active item is right on first paint and
  // stays right on client navigations (the layout itself doesn't re-render).
  const pathname = usePathname();
  const current = activeHref(pathname);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onSignOut = () =>
    startTransition(async () => {
      const result = await signOut();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.replace("/admin/login");
      router.refresh();
    });

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col items-start gap-3 px-5 pt-6 pb-4">
        <Link href="/admin" onClick={onNavigate} className="rounded-lg">
          <Logo />
        </Link>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[0.65rem] font-semibold tracking-[0.14em] text-primary-ink uppercase">Admin</span>
      </div>

      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 pb-6 [scrollbar-width:none]">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => !item.permission || admin.permissions.includes(item.permission));
          if (!items.length) return null;
          return (
            <div key={group.title} className="mt-5 first:mt-1">
              <p className="px-3 pb-2 text-[0.68rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">{group.title}</p>
              <ul className="flex flex-col gap-0.5">
                {items.map(({ href, label, icon: Icon }) => {
                  const active = href === current;
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          active ? "bg-primary text-primary-foreground shadow-[0_6px_20px_-8px_var(--primary)]" : "text-foreground/70 hover:bg-surface-2 hover:text-foreground"
                        )}
                      >
                        <Icon weight={active ? "fill" : "regular"} className={cn("size-[1.15rem]", !active && "text-muted-foreground group-hover:text-foreground")} />
                        {label}
                        {href === "/admin/chats" && <ChatBadge active={active} />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 px-3 py-2">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-semibold uppercase">
            {admin.name.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{admin.name}</p>
            <p className="truncate text-xs text-muted-foreground capitalize">{admin.role}</p>
          </div>
          <ThemeToggle />
        </div>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-foreground/70 transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <ArrowSquareOutIcon className="size-[1.15rem] text-muted-foreground" />
          View live site
        </a>
        <button
          type="button"
          onClick={onSignOut}
          disabled={pending}
          className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-foreground/70 transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
        >
          <SignOutIcon className="size-[1.15rem] text-muted-foreground" />
          {pending ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </div>
  );
}

/** Desktop: fixed pane at lg+. Mobile: fixed top bar with the same body in a drawer. */
export function AdminSidebar({ admin }: { admin: ShellAdmin }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes (including back/forward).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync drawer with navigation
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <ChatWatcher />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-surface lg:block">
        <SidebarBody admin={admin} />
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="-ml-2 grid size-11 place-items-center rounded-xl text-foreground/80 hover:bg-surface-2"
        >
          <ListIcon className="size-5" />
        </button>
        <Link href="/admin" className="absolute left-1/2 -translate-x-1/2">
          <Logo />
        </Link>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[0.65rem] font-semibold tracking-[0.14em] text-primary-ink uppercase">Admin</span>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 gap-0 border-border bg-surface p-0 data-[side=left]:w-72" showCloseButton={false}>
          <SheetTitle className="sr-only">Admin menu</SheetTitle>
          <SheetDescription className="sr-only">Navigate the admin sections.</SheetDescription>
          <SidebarBody admin={admin} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
