import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { cn, glassCard, pageTitleClass } from "@/lib/utils";

export const metadata = {
  title: "Privacy Policy",
  description:
    "How PackWise collects, stores, and uses your account, trip, and packing data.",
};

const LAST_UPDATED = "August 6, 2026";
const CONTACT_EMAIL = "support@packwise.app";

export default function PrivacyPage() {
  return (
    <main
      id="main-content"
      className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16"
    >
      <BrandLogo href="/" />
      <div className={cn(glassCard, "mt-8 p-6 sm:p-10")}>
        <h1 className={pageTitleClass}>Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {LAST_UPDATED}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          This is a product template policy for PackWise. It is not
          lawyer-reviewed legal advice. Replace with counsel-approved copy if
          your jurisdiction or launch plans require it.
        </p>

        <div className="mt-8 space-y-6 text-base leading-relaxed text-muted-foreground">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Who we are
            </h2>
            <p>
              PackWise (“we”, “us”) provides weather-aware packing lists and
              related trip tools at packwise.app. Questions about this policy:
              email{" "}
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
              Information we collect
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-foreground">Account data</span>{" "}
                — email address and authentication details when you sign in
                (email/password or Google).
              </li>
              <li>
                <span className="font-medium text-foreground">Trip data</span> —
                destinations, dates, trip types, notes, and packing lists you
                create or edit.
              </li>
              <li>
                <span className="font-medium text-foreground">Preferences</span>{" "}
                — optional settings such as notification choices, theme, and
                similar product preferences.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Usage &amp; device signals
                </span>{" "}
                — limited technical data needed to operate the service (for
                example session cookies and basic analytics if you consent).
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              How we use your information
            </h2>
            <p>
              We use this data to run PackWise: authenticate you, store and
              display your trips and packing lists, generate packing suggestions,
              show weather context for destinations, send reminders you opt into,
              process Pro subscriptions when enabled, and improve reliability and
              security.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Storage and security
            </h2>
            <p>
              Account authentication and application data are hosted with{" "}
              <span className="font-medium text-foreground">Supabase</span>. We
              apply reasonable technical and organizational measures appropriate
              to a small SaaS product. No method of transmission or storage is
              100% secure.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Third-party services
            </h2>
            <p>
              We share data with service providers only as needed to operate
              PackWise. Current processors include:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-foreground">Supabase</span> —
                authentication and database.
              </li>
              <li>
                <span className="font-medium text-foreground">Vercel</span> —
                application hosting and delivery.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Google Gemini
                </span>{" "}
                — packing-list generation and related AI features (trip context
                you submit may be sent to generate suggestions).
              </li>
              <li>
                <span className="font-medium text-foreground">Open-Meteo</span> —
                weather forecasts for destinations.
              </li>
              <li>
                <span className="font-medium text-foreground">Resend</span> —
                transactional email (for example reminders you enable).
              </li>
              <li>
                <span className="font-medium text-foreground">Stripe</span> —
                payment processing for Pro when billing is enabled.
              </li>
            </ul>
            <p>
              These providers process data under their own terms and privacy
              policies. We do not sell your personal data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Cookies and analytics
            </h2>
            <p>
              We use cookies and similar technologies required for sign-in and
              session security. Optional analytics run only when you consent via
              the cookie banner, where applicable.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Your choices
            </h2>
            <p>
              You can export your trips and packing lists from Settings, and you
              can permanently delete your account and associated data from the
              same page. You may contact us at {CONTACT_EMAIL} for privacy
              questions.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Changes
            </h2>
            <p>
              We may update this policy as the product evolves. The “Last
              updated” date above reflects the latest revision. Continued use
              after changes means you acknowledge the updated policy.
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
