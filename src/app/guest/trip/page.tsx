import { permanentRedirect } from "next/navigation";

export default function GuestTripPage() {
  permanentRedirect("/dashboard/guest");
}
