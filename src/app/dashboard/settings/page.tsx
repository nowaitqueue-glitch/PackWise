import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LogoutButton } from "@/components/LogoutButton";
import { SettingsAccount } from "./settings-account";
import { SettingsAppearance } from "./settings-appearance";
import { SettingsNotifications } from "./settings-notifications";
import { SettingsPrivacy } from "./settings-privacy";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? "";

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("packing_reminder_email, push_notifications")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const packingReminderEmail =
    profile?.packing_reminder_email !== false;
  const pushNotifications = profile?.push_notifications !== false;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your PackWise account, notifications, and privacy.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Your email and sign-in credentials.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsAccount email={email} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Choose how PackWise can reach you about upcoming trips.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsNotifications
              showPackingReminder
              packingReminderEmail={packingReminderEmail}
              pushNotifications={pushNotifications}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Theme and motion preferences for this device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsAppearance />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Privacy &amp; Data</CardTitle>
            <CardDescription>
              Export your data, review policies, or delete your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsPrivacy />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logout</CardTitle>
            <CardDescription>
              Sign out of PackWise on this device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LogoutButton />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
