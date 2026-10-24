// Primary nav: the live store's menu plus Categories and Brands. /budget-friendly redirects to the
// shop filtered to under $25 (next.config.ts), so the old URL keeps working.
// `wide` links only fit the desktop bar from 1280px; the mobile menu always shows every link.
export const navLinks = [
  { label: "Shop", href: "/shop" },
  { label: "Categories", href: "/categories" },
  { label: "Brands", href: "/brands" },
  { label: "IGET Bulk Buy", href: "/product-category/iget-vapes-bulk-buy" },
  { label: "Alibarbar Pandora", href: "/product-category/alibarbar-pandora", wide: true },
  { label: "Budget Vapes", href: "/budget-friendly", wide: true },
] as const;
