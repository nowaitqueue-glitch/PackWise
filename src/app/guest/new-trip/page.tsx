import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewTripForm } from "@/app/dashboard/new-trip/new-trip-form";
import { Button } from "@/components/ui/button";
import { pageTitleClass } from "@/lib/utils";

export default function GuestNewTripPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit text-muted-foreground"
        >
          <Link href="/dashboard/guest">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to guest dashboard
          </Link>
        </Button>
        <div className="space-y-2">
          <h1 className={pageTitleClass}>New trip</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Tell us where you&apos;re going and we&apos;ll help you pack. Your
            trip stays in this browser until you create an account.
          </p>
        </div>
      </div>
      <NewTripForm guestMode />
    </main>
  );
}
