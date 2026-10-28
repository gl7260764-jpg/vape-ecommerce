import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { OPEN_GRAPH, TITLE_SUFFIX } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Best Vape Shop Australia | Disposable Vapes, Bulk Buys",
    template: `%s${TITLE_SUFFIX}`,
  },
  // Pages that set their own titles also set full Open Graph tags (src/lib/seo.ts pageMetadata).
  openGraph: OPEN_GRAPH,
  twitter: { card: "summary_large_image" },
  description:
    "Shop IGET, Alibarbar, HQD and more. Genuine disposable vapes with bulk-buy pricing and Australia-wide shipping. Adults 18+ only.",
  // Added to an iPhone or iPad home screen: the app's name, and a dark status bar that keeps its own
  // space (a translucent one would sit on top of the navbar).
  appleWebApp: { capable: true, title: "Best Vape", statusBarStyle: "black" },
  // Google Search Console (URL prefix property, HTML tag method). Removing it un-verifies the site.
  verification: { google: "FIpkve3vW-lPFJSxHkyWP9AwwXS8Ga1hMbqEV2kCq28" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d0e12" },
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the theme class before paint, so the server markup differs on purpose.
    <html
      lang="en-AU"
      suppressHydrationWarning
      className={`${archivo.variable} ${geist.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-dvh">
        <ThemeProvider>
          {children}
          <Toaster position="bottom-center" />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
