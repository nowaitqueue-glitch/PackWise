import { BrandLogo } from "@/components/brand-logo";
import { LandingBackground } from "@/components/landing-background";
import { PageTransition } from "@/components/page-transition";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <PageTransition>
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10 sm:py-14">
        <LandingBackground />
        <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-6">
          <BrandLogo href="/" className="drop-shadow-sm" />
          <ResetPasswordForm />
        </div>
      </main>
    </PageTransition>
  );
}
