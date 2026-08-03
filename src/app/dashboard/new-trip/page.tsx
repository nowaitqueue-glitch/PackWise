import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { pageTitleClass } from "@/lib/utils";
import { NewTripForm } from "./new-trip-form";

export default async function NewTripPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit text-muted-foreground"
        >
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to dashboard
          </Link>
        </Button>
        <div className="space-y-2">
          <h1 className={pageTitleClass}>New trip</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Tell us where you&apos;re going and we&apos;ll help you pack.
          </p>
        </div>
      </div>
      <NewTripForm />
    </main>
  );
}
