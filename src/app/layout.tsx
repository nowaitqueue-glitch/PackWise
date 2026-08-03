import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import localFont from "next/font/local";
import { Analytics } from "@/components/analytics";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/theme-provider";
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

export const metadata: Metadata = {
  title: "PackWise",
  description: "Smart packing lists for every trip",
  applicationName: "PackWise",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PackWise",
  },
  icons: {
    icon: [
      { url: "/images/logo.png", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/images/logo.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192" },
    ],
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
  return (
    <html lang="en" suppressHydrationWarning className={nunito.variable}>
      <body
        className={cn(
          nunito.className,
          geistMono.variable,
          "min-h-screen font-sans text-base leading-relaxed antialiased"
        )}
      >
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
            <ErrorBoundary>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                {children}
                <CookieConsentBanner />
                <Analytics />
              </ThemeProvider>
            </ErrorBoundary>
          </div>
        </div>
      </body>
    </html>
  );
}
