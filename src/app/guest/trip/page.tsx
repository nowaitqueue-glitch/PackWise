import { redirect } from "next/navigation";

export default function GuestTripPage() {
  redirect("/dashboard/guest");
}