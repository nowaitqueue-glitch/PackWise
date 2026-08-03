import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard-header";
import { DashboardLayoutGroup } from "@/components/dashboard-layout-group";
import { DashboardProviders } from "@/components/dashboard-providers";
import { DashboardShell } from "@/components/dashboard-shell";
import { GuestHeader } from "@/components/guest-header";
import { GuestModeBanner } from "@/components/guest-mode-banner";
import { NewTripFab } from "@/components/new-trip-fab";
import { PageTransition } from "@/components/page-transition";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <DashboardProviders>
        <DashboardShell>
          <GuestModeBanner />
          <GuestHeader />
          <DashboardLayoutGroup>
            <PageTransition>{children}</PageTransition>
          </DashboardLayoutGroup>
        </DashboardShell>
      </DashboardProviders>
    );
  }

  return (
    <DashboardProviders>
      <DashboardShell>
        <DashboardHeader email={user.email} />
        <DashboardLayoutGroup>
          <PageTransition>{children}</PageTransition>
        </DashboardLayoutGroup>
        <NewTripFab />
      </DashboardShell>
    </DashboardProviders>
  );
}
