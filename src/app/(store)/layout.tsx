import { Suspense } from "react";
import { PageTracker } from "@/components/analytics/page-tracker";
import { ChatLauncher } from "@/components/chat/customer/chat-launcher";
import { AppOffers } from "@/components/app/app-offers";
import { PopupTrigger } from "@/components/newsletter/popup-trigger";
import { SmoothScroll } from "@/components/providers/smooth-scroll";
import { AgeGate } from "@/components/site/age-gate";
import { CartSheet } from "@/components/site/cart-sheet";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { getHomeCatalog } from "@/lib/catalog-queries";
import { getNewsletterSettings } from "@/lib/newsletter";

// Shared chrome for every storefront page: header (with popular picks for search), footer,
// cart drawer, age gate, film grain, smooth scrolling, visitor analytics, the order chat and the newsletter pop-up.
// The admin gets none of these.
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const { featured } = await getHomeCatalog();
  return (
    <SmoothScroll>
      <div className="grain">
        <Header products={featured} />
        <main>{children}</main>
        <Footer />
        <CartSheet />
        <AgeGate />
        <Suspense fallback={null}>
          <PageTracker />
        </Suspense>
        <Suspense fallback={null}>
          <ChatLauncher />
        </Suspense>
        <Suspense fallback={null}>
          <NewsletterPopup />
        </Suspense>
      </div>
    </SmoothScroll>
  );
}

// The newsletter pop-up and the app install offers share the owner's settings and timing.
async function NewsletterPopup() {
  const settings = await getNewsletterSettings();
  return (
    <>
      <PopupTrigger settings={settings} />
      <AppOffers settings={settings} />
    </>
  );
}
