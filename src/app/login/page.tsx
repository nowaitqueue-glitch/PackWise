import { BrandLogo } from "@/components/brand-logo";
import { LandingBackground } from "@/components/landing-background";
import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: {
    next?: string;
    error?: string;
    deleted?: string;
    from?: string;
    claim?: string;
  };
};

function safeNextPath(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  return next;
}

function wantsGuestClaim(
  searchParams: LoginPageProps["searchParams"]
): boolean {
  if (searchParams.claim === "guest" || searchParams.from === "guest") {
    return true;
  }
  const next = safeNextPath(searchParams.next);
  return next === "/guest/claim" || next.startsWith("/guest/claim?");
}

function resolveNextPath(
  searchParams: LoginPageProps["searchParams"]
): string {
  if (wantsGuestClaim(searchParams)) {
    return "/guest/claim";
  }
  return safeNextPath(searchParams.next);
}

function bannerFromParams(
  searchParams: LoginPageProps["searchParams"]
): { message: string; variant: "success" | "error" | "info" } | null {
  if (searchParams.deleted === "1") {
    return {
      message: "Your account has been deleted.",
      variant: "info",
    };
  }
  if (searchParams.error === "auth") {
    return {
      message: "Sign-in link was invalid or expired. Try again.",
      variant: "error",
    };
  }
  if (wantsGuestClaim(searchParams)) {
    return {
      message:
        "Create a free account or sign in to save your guest trip and unlock all features.",
      variant: "info",
    };
  }
  return null;
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const nextPath = resolveNextPath(searchParams);
  const claimGuest = wantsGuestClaim(searchParams);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-6 sm:py-14">
      <LandingBackground />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-6">
        <BrandLogo href="/" className="drop-shadow-sm" />
        <LoginForm
          nextPath={nextPath}
          claimGuest={claimGuest}
          initialBanner={bannerFromParams(searchParams)}
          fromSignup={
            searchParams.from === "signup" || searchParams.from === "guest"
          }
        />
      </div>
    </main>
  );
}
