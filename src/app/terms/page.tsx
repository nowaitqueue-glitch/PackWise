import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { cn, glassCard, pageTitleClass } from "@/lib/utils";

export const metadata = {
  title: "Terms of Service · PackWise",
  description: "Terms for using PackWise.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <BrandLogo href="/" />
      <div className={cn(glassCard, "mt-8 p-6 sm:p-10")}>
        <h1 className={pageTitleClass}>Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: July 22, 2026
        </p>
        <div className="mt-8 space-y-4 text-base leading-relaxed text-muted-foreground">
          <p>
            By using PackWise you agree to use the service lawfully and to keep
            your account credentials secure. Packing suggestions are
            informational and may be incomplete — always apply your own judgment
            when traveling.
          </p>
          <p>
            Features marked as Pro may require a paid subscription. Free-tier
            limits (such as suitcase scans) may change as the product evolves.
          </p>
          <p>
            We may suspend accounts that abuse the service or attempt to
            interfere with other users. You may delete your account at any time
            from Settings.
          </p>
          <p>
            This page is a concise product stub. Replace it with
            counsel-reviewed legal copy before a public launch.
          </p>
        </div>
      </div>
      <p className="mt-8 text-sm">
        <Link
          href="/"
          className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Back to PackWise
        </Link>
      </p>
    </main>
  );
}
