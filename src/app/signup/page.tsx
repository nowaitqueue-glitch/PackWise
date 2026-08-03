import { redirect } from "next/navigation";

type SignupPageProps = {
  searchParams: { from?: string };
};

/**
 * Minimal signup entry — PackWise uses magic-link / password on /login.
 * Preserves `from=guest` so claim flow can run after auth.
 */
export default function SignupPage({ searchParams }: SignupPageProps) {
  if (searchParams.from === "guest") {
    redirect("/login?next=/guest/claim&from=guest");
  }
  redirect("/login?next=/dashboard&from=signup");
}