import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { parseDestinationParts } from "@/lib/trip-destination";
import { isTripType } from "@/lib/trips";
import { NewTripForm } from "@/app/dashboard/new-trip/new-trip-form";
import { Button } from "@/components/ui/button";
import { pageTitleClass } from "@/lib/utils";

type EditTripPageProps = {
  params: { id: string };
};

export default async function EditTripPage({ params }: EditTripPageProps) {
  const { id } = params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: trip, error } = await supabase
    .from("trips")
    .select("id, user_id, destination, start_date, end_date, trip_type, travelers")
    .eq("id", id)
    .maybeSingle();

  if (error || !trip) {
    notFound();
  }

  if (trip.user_id !== user.id) {
    redirect(`/dashboard/trips/${id}`);
  }

  const { city, countryCode } = parseDestinationParts(trip.destination);
  const tripType = isTripType(trip.trip_type) ? trip.trip_type : "";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit text-muted-foreground"
        >
          <Link href={`/dashboard/trips/${trip.id}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Cancel
          </Link>
        </Button>
        <div className="space-y-2">
          <h1 className={pageTitleClass}>Edit trip</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Update where you&apos;re going — we&apos;ll refresh your packing
            list if anything essential changes.
          </p>
        </div>
      </div>
      <NewTripForm
        mode="edit"
        tripId={trip.id}
        defaultValues={{
          city,
          countryCode,
          start_date: trip.start_date,
          end_date: trip.end_date,
          trip_type: tripType,
          travelers: trip.travelers,
        }}
      />
    </main>
  );
}
