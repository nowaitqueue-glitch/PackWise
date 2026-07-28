import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <main className="mx-auto flex w-full max-w-md flex-col px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>New trip</CardTitle>
          <CardDescription>
            Tell us where you&apos;re going and we&apos;ll help you pack.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <NewTripForm />
          <Button asChild variant="ghost" className="w-full">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
