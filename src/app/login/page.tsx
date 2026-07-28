import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: { next?: string; error?: string; deleted?: string };
};

function safeNextPath(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  return next;
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
  return null;
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <BrandLogo href="/" />
      <LoginForm
        nextPath={safeNextPath(searchParams.next)}
        initialBanner={bannerFromParams(searchParams)}
      />
    </main>
  );
}
