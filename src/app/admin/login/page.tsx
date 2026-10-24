import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/site/logo";
import { LoginForm } from "@/components/admin/login-form";
import { getAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

async function LoginGate({ searchParams }: Pick<PageProps<"/admin/login">, "searchParams">) {
  // Already signed in: straight to the dashboard.
  if (await getAdmin()) redirect("/admin");
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : undefined} />;
}

export default function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-background px-4 py-12">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="inline-block" aria-label="Back to the store">
          <Logo />
        </Link>
        <div className="mt-8 rounded-[var(--radius-tile)] border border-border bg-surface p-6 shadow-[var(--shadow-soft)] sm:p-8">
          <p className="text-xs font-medium tracking-[0.18em] text-primary-ink uppercase">Admin</p>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight uppercase">Sign in</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">For the store team only.</p>
          <div className="mt-7">
            <Suspense fallback={<div className="h-[13.5rem] animate-pulse rounded-xl bg-surface-2/60" />}>
              <LoginGate searchParams={searchParams} />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
