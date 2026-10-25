import { BellRingingIcon, BuildingsIcon, ChartBarIcon, ChatsCircleIcon, EnvelopeSimpleIcon, ReceiptIcon, FoldersIcon, MegaphoneIcon, PackageIcon, SquaresFourIcon, TrademarkIcon, TruckIcon, UsersThreeIcon, type Icon } from "@phosphor-icons/react";
import type { Permission } from "@/lib/admin/auth";

export type NavItem = { href: string; label: string; icon: Icon; permission?: Permission };
export type NavGroup = { title: string; items: NavItem[] };

/** The admin navigation, defined once. Desktop sidebar and mobile drawer both render it. */
export const NAV_GROUPS: NavGroup[] = [
  { title: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: SquaresFourIcon }] },
  {
    title: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ReceiptIcon },
      { href: "/admin/chats", label: "Chats", icon: ChatsCircleIcon },
    ],
  },
  {
    title: "Insights",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: ChartBarIcon },
      { href: "/admin/analytics/visitors", label: "Visitors", icon: UsersThreeIcon },
    ],
  },
  {
    title: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: PackageIcon },
      { href: "/admin/categories", label: "Categories", icon: FoldersIcon },
      { href: "/admin/brands", label: "Brands", icon: TrademarkIcon },
    ],
  },
  {
    title: "Marketing",
    items: [
      { href: "/admin/subscribers", label: "Subscribers", icon: EnvelopeSimpleIcon },
      { href: "/admin/push", label: "Push notifications", icon: BellRingingIcon, permission: "settings:write" },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/admin/settings/shipping", label: "Shipping", icon: TruckIcon, permission: "settings:write" },
      { href: "/admin/settings/business", label: "Business details", icon: BuildingsIcon, permission: "settings:write" },
      { href: "/admin/settings/newsletter", label: "Newsletter pop-up", icon: MegaphoneIcon, permission: "settings:write" },
    ],
  },
];

/** Dashboard matches exactly; everything else also matches its detail pages. */
export const isActive = (href: string, pathname: string) =>
  href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

/** The one nav item to highlight: the most specific match, so /admin/analytics/visitors lights Visitors, not Analytics. */
export const activeHref = (pathname: string) =>
  NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href))
    .filter((href) => isActive(href, pathname))
    .sort((a, b) => b.length - a.length)[0] ?? null;
