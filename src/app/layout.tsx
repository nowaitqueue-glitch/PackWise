import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Nunito } from "next/font/google";
import localFont from "next/font/local";
import { Analytics } from "@/components/analytics";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { ThemeProvider } from "@/components/theme-provider";
import { getSiteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-mono",
  weight: "100 900",
});

const siteUrl = getSiteUrl();
const siteDescription =
  "PackWise builds weather-aware packing lists for every trip — create trips, check off items as you pack, and revisit past trips anytime.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "PackWise",
    template: "%s · PackWise",
  },
  description: siteDescription,
  applicationName: "PackWise",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PackWise",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "PackWise",
    title: "PackWise — Pack smarter for every trip",
    description: siteDescription,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PackWise — Pack smarter for every trip",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PackWise — Pack smarter for every trip",
    description: siteDescription,
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3B82F6" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1220" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading headers() opts the tree into dynamic rendering so the per-request
  // CSP nonce from middleware can be applied to third-party Script tags.
  const nonce = headers().get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning className={nunito.variable}>
      <body
        className={cn(
          nunito.className,
          geistMono.variable,
          "min-h-screen font-sans text-base leading-relaxed antialiased"
        )}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring dark:focus:bg-card"
        >
          Skip to content
        </a>
        <div className="relative min-h-screen">
          {/* Soft travel-toned wash + repeating pattern behind every page. */}
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-20 bg-gradient-to-br from-blue-50 via-slate-50 to-teal-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
          />
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-10 bg-[url('/images/pattern.png')] bg-repeat bg-fixed max-sm:bg-scroll opacity-[0.07] dark:opacity-[0.05]"
          />
          <div className="relative z-10">
            <GlobalErrorBoundary>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
                nonce={nonce}
              >
                {children}
                <CookieConsentBanner />
                <Analytics nonce={nonce} />
              </ThemeProvider>
            </GlobalErrorBoundary>
          </div>
        </div>
      </body>
    </html>
  );
}
