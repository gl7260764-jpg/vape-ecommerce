"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { track } from "@/lib/analytics/client";

/** Records a page view on every storefront navigation (path or query change). */
export function PageTracker() {
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search.toString();

  useEffect(() => {
    // A short delay lets the new page's <title> land first.
    const timer = window.setTimeout(() => track("page_view"), 80);
    return () => window.clearTimeout(timer);
  }, [pathname, query]);

  return null;
}
