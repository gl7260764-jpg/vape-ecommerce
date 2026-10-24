import type { Metadata, Viewport } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
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
  metadataBase: new URL(process.env.SITE_URL ?? "https://bestvapeshopaustralia.com.au"),
  title: {
    default: "Best Vape Shop Australia | Disposable Vapes, Bulk Buys",
    template: "%s | Best Vape Shop Australia",
  },
  description:
    "Shop IGET, Alibarbar, HQD and more. Genuine disposable vapes with bulk-buy pricing and Australia-wide shipping. Adults 18+ only.",
  // Added to an iPhone or iPad home screen: the app's name and a dark status bar.
  appleWebApp: { capable: true, title: "Best Vape", statusBarStyle: "black-translucent" },
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
      </body>
    </html>
  );
}
