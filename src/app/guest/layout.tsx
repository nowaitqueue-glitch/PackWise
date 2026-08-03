import { GuestHeader } from "@/components/guest-header";
import { GuestModeBanner } from "@/components/guest-mode-banner";
import { DashboardProviders } from "@/components/dashboard-providers";

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardProviders>
      <div className="relative min-h-screen bg-transparent">
        <GuestModeBanner />
        <GuestHeader />
        <div className="relative z-10">{children}</div>
      </div>
    </DashboardProviders>
  );
}
