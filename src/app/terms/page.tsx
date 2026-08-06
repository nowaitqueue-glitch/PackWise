import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { cn, glassCard, pageTitleClass } from "@/lib/utils";

export const metadata = {
  title: "Terms of Service",
  description: "Terms that govern your use of PackWise.",
};

const LAST_UPDATED = "August 6, 2026";
const CONTACT_EMAIL = "support@packwise.app";

export default function TermsPage() {
  return (
    <main
      id="main-content"
      className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16"
    >
      <BrandLogo href="/" />
      <div className={cn(glassCard, "mt-8 p-6 sm:p-10")}>
        <h1 className={pageTitleClass}>Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {LAST_UPDATED}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          This is a product template for PackWise. It is not lawyer-reviewed
          legal advice. Replace with counsel-approved terms if your jurisdiction
          or launch plans require it.
        </p>

        <div className="mt-8 space-y-6 text-base leading-relaxed text-muted-foreground">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Agreement
            </h2>
            <p>
              By accessing or using PackWise (“the service”), you agree to these
              Terms of Service. If you do not agree, do not use the service.
              Questions:{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              The service
            </h2>
            <p>
              PackWise helps you create packing lists based on trip details and
              weather context, share lists, and use related tools such as
              suitcase scan. Features may change, and packing suggestions are
              informational — always apply your own judgment when traveling.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Accounts
            </h2>
            <p>
              You are responsible for the accuracy of information you provide
              and for keeping access to your email (and password, if set)
              secure. You must use the service lawfully and must not attempt to
              disrupt, scrape abusively, reverse engineer, or misuse PackWise or
              other users’ data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Guest use and Pro features
            </h2>
            <p>
              Guest mode may store trip data locally in your browser until you
              claim it with an account. Features marked as Pro may require a paid
              subscription processed by Stripe. Free-tier limits (such as
              suitcase scans) may change as the product evolves.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Content you submit
            </h2>
            <p>
              You retain ownership of trip and packing content you create. You
              grant us a limited license to host, process, and display that
              content solely to provide the service (including sending necessary
              data to subprocessors described in our Privacy Policy).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Suspension and termination
            </h2>
            <p>
              We may suspend or terminate accounts that abuse the service,
              violate these terms, or create security or operational risk. You
              may delete your account at any time from Settings.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Disclaimer
            </h2>
            <p>
              PackWise is provided “as is” and “as available” without warranties
              of any kind, express or implied, including fitness for a particular
              purpose or non-infringement. We do not guarantee that packing lists,
              weather data, or AI suggestions are complete, accurate, or suitable
              for your trip.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Limitation of liability
            </h2>
            <p>
              To the fullest extent permitted by law, PackWise and its operators
              are not liable for any indirect, incidental, special,
              consequential, or punitive damages, or for lost profits, data, or
              travel-related costs arising from your use of the service. Our
              aggregate liability for claims relating to the service is limited
              to the greater of (a) the amounts you paid us for PackWise in the
              twelve months before the claim or (b) fifty U.S. dollars (US $50).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Changes
            </h2>
            <p>
              We may update these terms from time to time. The “Last updated”
              date reflects the latest revision. Continued use after changes
              constitutes acceptance of the updated terms.
            </p>
          </section>
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
