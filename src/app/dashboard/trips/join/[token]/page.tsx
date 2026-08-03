import Link from "next/link";
import { redirect } from "next/navigation";
import { joinTripByToken } from "@/app/dashboard/trip-invite-actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn, glassCard } from "@/lib/utils";

type JoinTripPageProps = {
  params: { token: string };
};

export default async function JoinTripPage({ params }: JoinTripPageProps) {
  const { token } = params;

  if (!token?.trim()) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/dashboard/trips/join/${token}`)}`
    );
  }

  const result = await joinTripByToken(token);

  // joinTripByToken redirects on success; only error path reaches here
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <Card className={cn("w-full max-w-md", glassCard)}>
        <CardHeader>
          <CardTitle className="text-xl">Could not join trip</CardTitle>
          <CardDescription>
            {result.ok
              ? "Something went wrong."
              : result.error}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
