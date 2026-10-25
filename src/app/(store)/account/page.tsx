import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRightIcon, ChatsCircleIcon, ReceiptIcon } from "@phosphor-icons/react/dist/ssr";
import { OrderCard } from "@/components/account/order-card";
import { SignInForm } from "@/components/account/sign-in-form";
import { SignOut } from "@/components/account/sign-out";
import { NotificationsCard } from "@/components/app/notifications-card";
import { OpenChatButton } from "@/components/chat/customer/open-chat-button";
import { OpenChatNow } from "@/components/chat/customer/open-chat-now";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { accountForDevice, addOrderSummaries } from "@/lib/account";
import { currentDeviceTokenHash, ordersForThisDevice } from "@/lib/customer-orders";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

const CARD = "rounded-[var(--radius-tile)] border border-border bg-surface p-6 md:p-7";

function SignInCard() {
  return (
    <div className={`mt-8 max-w-lg ${CARD}`}>
      <p className="leading-relaxed text-muted-foreground">Enter your email to open your account. New here? This creates one.</p>
      <SignInForm />
    </div>
  );
}

async function Account({ searchParams }: { searchParams: PageProps<"/account">["searchParams"] }) {
  const tokenHash = await currentDeviceTokenHash();
  const account = tokenHash ? await accountForDevice(tokenHash) : null;
  if (!tokenHash || !account) return <SignInCard />;

  // Orders placed elsewhere with this email show here as summaries.
  await addOrderSummaries(tokenHash, account.email).catch((error) => console.error("account order summaries failed", error));
  const orders = await ordersForThisDevice();

  return (
    <>
      <p className="mt-3 text-muted-foreground break-all">{account.email}</p>

      <div className={`mt-8 ${CARD} border-primary/40`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold uppercase">Chat with us</h2>
          {account.unread > 0 && (
            <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary-ink">{account.unread} new</span>
          )}
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {account.lastMessagePreview || "Questions about a product, payment or delivery? We usually reply within 5 minutes."}
        </p>
        <OpenChatButton className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
          <ChatsCircleIcon weight="fill" className="size-5" aria-hidden />
          Open chat
        </OpenChatButton>
      </div>

      <NotificationsCard />
      {(await searchParams).chat === "1" && <OpenChatNow />}

      <h2 className="mt-12 font-display text-2xl font-bold uppercase">Your orders</h2>
      {orders.length ? (
        <ul className="mt-6 grid gap-4">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </ul>
      ) : (
        <div className={`mt-6 flex flex-wrap items-center gap-4 ${CARD}`}>
          <span className="grid size-12 place-items-center rounded-full bg-surface-2">
            <ReceiptIcon className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <p className="flex-1 text-muted-foreground">No orders yet.</p>
          <Link href="/shop" className="inline-flex items-center gap-2 text-sm font-medium text-primary-ink hover:underline">
            Start shopping <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
        </div>
      )}

      <div className="mt-10">
        <SignOut />
      </div>
    </>
  );
}

export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <section className="mx-auto max-w-4xl px-4 pt-28 pb-20 sm:px-6 md:pt-32">
      <Breadcrumbs items={[{ label: "Your account" }]} />
      <h1 className="mt-8 font-display text-[clamp(2.25rem,6vw,4rem)] leading-[0.92] font-extrabold tracking-[-0.03em] uppercase">Your account</h1>
      <Suspense fallback={<div className="mt-10 h-72 animate-pulse rounded-[var(--radius-tile)] bg-surface" aria-label="Loading your account" />}>
        <Account searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
