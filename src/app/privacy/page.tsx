import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { cn, glassCard, pageTitleClass } from "@/lib/utils";

export const metadata = {
  title: "Privacy Policy",
  description: "How PackWise handles your data.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <BrandLogo href="/" />
      <div className={cn(glassCard, "mt-8 p-6 sm:p-10")}>
        <h1 className={pageTitleClass}>Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: July 22, 2026
        </p>
        <div className="mt-8 space-y-4 text-base leading-relaxed text-muted-foreground">
          <p>
            PackWise stores the account information you provide (such as email),
            trip details you create, packing lists, and optional preferences
            like notification settings. We use this data to run the product —
            generate lists, show weather context, and send reminders you opt
            into.
          </p>
          <p>
            Authentication and database hosting are provided by Supabase.
            Payment processing for Pro (when enabled) is handled by Stripe. We
            do not sell your personal data.
          </p>
          <p>
            You can export your trips and packing lists from Settings, and you
            can permanently delete your account and associated data from the
            same page.
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
