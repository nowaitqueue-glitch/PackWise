import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard-header";
import { DashboardLayoutGroup } from "@/components/dashboard-layout-group";
import { DashboardProviders } from "@/components/dashboard-providers";
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

  return (
    <DashboardProviders>
      <div className="min-h-screen bg-background">
        <DashboardHeader email={user?.email} />
        <DashboardLayoutGroup>
          <PageTransition>{children}</PageTransition>
        </DashboardLayoutGroup>
        <NewTripFab />
      </div>
    </DashboardProviders>
  );
}
