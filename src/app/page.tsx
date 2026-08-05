import Link from "next/link";
import { Suspense } from "react";
import { CloudSun, ListChecks, ScanLine, Users2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BrandLogo } from "@/components/brand-logo";
import { LandingBackground } from "@/components/landing-background";
import { MagicLinkLandingHandler } from "@/components/magic-link-landing-handler";
import { PageTransition } from "@/components/page-transition";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  cn,
  glassCard,
  glassCardHover,
  iconTileClass,
  sectionTitleClass,
  travelGradientText,
} from "@/lib/utils";

const featureIconClass = cn("size-11 rounded-xl", iconTileClass);

const features = [
  {
    title: "Smart packing lists",
    icon: ListChecks,
    description:
      "Get a trip-ready checklist from destination, dates, trip type, and the forecast.",
  },
  {
    title: "Weather-aware",
    icon: CloudSun,
    description:
      "See daily highs, lows, and rain chance so you pack for the forecast, not guesswork.",
  },
  {
    title: "Shared trips",
    icon: Users2,
    description:
      "Share your packing list so friends can see what you’re bringing. Shared lists are view-only for now.",
    plannedLabel: "Live collaborative check-offs",
  },
  {
    title: "Suitcase scan",
    icon: ScanLine,
    description:
      "Snap what is already packed and PackWise suggests what is missing — 3 free scans per month, unlimited on Pro.",
  },
] as const;

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { deleted?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const accountDeleted = searchParams?.deleted === "1";

  return (
    <PageTransition>
      <div className="relative min-h-screen">
        <Suspense fallback={null}>
          <MagicLinkLandingHandler />
        </Suspense>
        {/* Full-bleed hero plane behind sticky header + first viewport */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[min(100vh,56rem)] overflow-hidden"
        >
          <LandingBackground className="absolute inset-0" />
        </div>

        <header className="sticky top-0 z-40 border-b border-white/20 bg-transparent backdrop-blur-sm dark:border-white/10 dark:bg-black/10">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
            <BrandLogo href="/" variant="light" />
            <div className="flex items-center gap-1 sm:gap-2">
              <ThemeToggle variant="light" />
              {user ? (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="border-white/30 bg-transparent text-white shadow-sm hover:bg-white/10 hover:text-white"
                >
                  <Link href="/dashboard">Go to dashboard</Link>
                </Button>
              ) : (
                <Link
                  href="/login"
                  className="rounded-md border border-white/30 px-3 py-1.5 text-sm text-white shadow-sm transition-colors hover:bg-white/10"
                >
                  Log in
                </Link>
              )}
            </div>
          </div>
        </header>

        <div className="relative">
          <section className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col justify-center px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16">
            {accountDeleted ? (
              <div
                role="status"
                className={cn(
                  glassCard,
                  "mb-8 max-w-2xl px-4 py-3 text-sm text-foreground"
                )}
              >
                Your PackWise account and data have been permanently deleted.
              </div>
            ) : null}

            <div className="max-w-2xl">
              <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
                <span className={travelGradientText}>PackWise</span>
              </h1>
              <p className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Pack smarter for every trip
              </p>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Weather-aware packing lists tuned to your destination and forecast.
                Share your list so friends can see what you’re bringing, and scan
                your suitcase before you leave.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {user ? (
                  <Button asChild size="lg">
                    <Link href="/dashboard">Go to dashboard</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild size="lg">
                      <Link href="/login?from=signup">Get Started</Link>
                    </Button>
                    <Button asChild size="lg" variant="secondary">
                      <Link href="/dashboard/guest">Try as Guest</Link>
                    </Button>
                  </>
                )}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Magic-link sign-in. Works as a Progressive Web App on your phone.
              </p>
            </div>
          </section>
        </div>

        <main className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6">
          <section className="border-t border-border/60 pt-12 sm:pt-16">
            <h2 className={cn(sectionTitleClass, "sm:text-2xl")}>
              Everything you need before you go
            </h2>
            <p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground">
              From first draft to last checkoff — packing without the spreadsheet.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-2">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li
                    key={feature.title}
                    className={cn(glassCard, glassCardHover, "p-5 sm:p-6")}
                  >
                    <div className="flex items-start gap-4">
                      <span className={featureIconClass} aria-hidden>
                        <Icon className="size-5" />
                      </span>
                      <div className="min-w-0 space-y-1.5">
                        <h3 className="text-base font-bold tracking-tight text-foreground">
                          {feature.title}
                        </h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {feature.description}
                        </p>
                          {"plannedLabel" in feature ? (
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
                            <span>{feature.plannedLabel}</span>
                            <Badge variant="secondary">Coming soon</Badge>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </main>

        <footer className="relative z-10 border-t border-border/60 bg-background/80 py-8 backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
            <span className={cn("text-base font-bold", travelGradientText)}>
              PackWise
            </span>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              <Link
                href="/privacy"
                className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                Terms
              </Link>
              <Link
                href={user ? "/dashboard" : "/login"}
                className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {user ? "Dashboard" : "Log in"}
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </PageTransition>
  );
}
