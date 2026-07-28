import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseDestinationParts } from "@/lib/trip-destination";
import { isTripType } from "@/lib/trips";
import { NewTripForm } from "@/app/dashboard/new-trip/new-trip-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    <main className="mx-auto flex w-full max-w-md flex-col px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Edit trip</CardTitle>
          <CardDescription>
            Update where you&apos;re going — we&apos;ll refresh your packing
            list if anything essential changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
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
          <Button asChild variant="ghost" className="w-full">
            <Link href={`/dashboard/trips/${trip.id}`}>Cancel</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
