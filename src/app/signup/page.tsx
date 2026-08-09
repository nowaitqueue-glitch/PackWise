import { redirect } from "next/navigation";

type SignupPageProps = {
  searchParams: { from?: string; claim?: string };
};

/**
 * Minimal signup entry — redirects to /login in create-account mode.
 * Preserves `from=guest` / `claim=guest` so claim flow can run after auth.
 */
export default function SignupPage({ searchParams }: SignupPageProps) {
  if (searchParams.from === "guest" || searchParams.claim === "guest") {
    redirect("/login?next=/guest/claim&from=guest&claim=guest");
  }
  redirect("/login?next=/dashboard&from=signup");
}