import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BrandLogo } from "@/components/brand-logo";
import { PageTransition } from "@/components/page-transition";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const features = [
  {
    title: "Smart packing lists",
    description:
      "Get a trip-ready checklist from destination, dates, trip type, and the forecast.",
  },
  {
    title: "Weather-aware",
    description:
      "See daily highs, lows, and rain chance so you pack for the forecast, not guesswork.",
  },
  {
    title: "Shared trips",
    description:
      "Share your packing list so friends can see what you’re bringing. Shared lists are view-only for now.",
    plannedLabel: "Live collaborative check-offs",
  },
  {
    title: "Suitcase scan",
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
      <div className="relative min-h-screen overflow-hidden bg-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--muted))_0%,_transparent_55%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,_transparent_0%,_hsl(var(--background))_85%)]"
        />

        <header className="relative z-10 border-b border-border/60 bg-background/70 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
            <BrandLogo href="/" />
            <div className="flex items-center gap-1">
              <ThemeToggle />
              {user ? (
                <Button asChild size="sm">
                  <Link href="/dashboard">Go to dashboard</Link>
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href="/login">Log in</Link>
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-col px-4 pb-20 pt-16 sm:pt-24">
          {accountDeleted ? (
            <div
              role="status"
              className="mb-8 max-w-2xl rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-foreground"
            >
              Your PackWise account and data have been permanently deleted.
            </div>
          ) : null}

          <section className="max-w-2xl">
            <h1 className="text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
              PackWise
            </h1>
            <p className="mt-4 text-xl font-medium tracking-tight text-foreground sm:text-2xl">
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
                    <Link href="/login">Get started</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/login">Log in</Link>
                  </Button>
                </>
              )}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Magic-link sign-in. Works as a Progressive Web App on your phone.
            </p>
          </section>

          <section className="mt-20 border-t border-border pt-12">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Everything you need before you go
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              From first draft to last checkoff — packing without the spreadsheet.
            </p>
            <ul className="mt-8 grid gap-8 sm:grid-cols-2">
              {features.map((feature) => (
                <li key={feature.title} className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                  {"plannedLabel" in feature ? (
                    <p className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
                      <span>{feature.plannedLabel}</span>
                      <Badge variant="secondary">Coming soon</Badge>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </main>

        <footer className="relative z-10 border-t border-border/60 py-6">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 text-sm text-muted-foreground">
            <span>PackWise</span>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/privacy"
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                Terms
              </Link>
              <Link
                href={user ? "/dashboard" : "/login"}
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                {user ? "Dashboard" : "Sign in"}
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </PageTransition>
  );
}
