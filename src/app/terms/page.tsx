import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export const metadata = {
  title: "Terms of Service · PackWise",
  description: "Terms for using PackWise.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <BrandLogo href="/" />
      <h1 className="mt-8 text-3xl font-semibold tracking-tight text-foreground">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: July 22, 2026
      </p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          By using PackWise you agree to use the service lawfully and to keep
          your account credentials secure. Packing suggestions are informational
          and may be incomplete — always apply your own judgment when traveling.
        </p>
        <p>
          Features marked as Pro may require a paid subscription. Free-tier
          limits (such as suitcase scans) may change as the product evolves.
        </p>
        <p>
          We may suspend accounts that abuse the service or attempt to interfere
          with other users. You may delete your account at any time from
          Settings.
        </p>
        <p>
          This page is a concise product stub. Replace it with counsel-reviewed
          legal copy before a public launch.
        </p>
      </div>
      <p className="mt-10 text-sm">
        <Link
          href="/"
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Back to PackWise
        </Link>
      </p>
    </main>
  );
}
