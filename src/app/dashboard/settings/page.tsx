import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  KeyRound,
  LogOut,
  Palette,
  ShieldCheck,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/LogoutButton";
import { Button } from "@/components/ui/button";
import { cn, glassCard, pageTitleClass, sectionTitleClass } from "@/lib/utils";
import { DeleteAccountButton } from "./delete-account-button";
import { SettingsAccount, SettingsPassword } from "./settings-account";
import { SettingsAppearance } from "./settings-appearance";
import { SettingsNotifications } from "./settings-notifications";
import { SettingsPrivacy } from "./settings-privacy";

function SettingsSection({
  icon: Icon,
  title,
  description,
  danger = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        glassCard,
        "p-5 sm:p-6",
        danger && "border-red-500/40 dark:border-red-500/30"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md",
            danger
              ? "bg-gradient-to-br from-red-500 to-rose-400"
              : "bg-gradient-to-br from-brand-from to-brand-to"
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            className={cn(
              sectionTitleClass,
              danger && "text-red-600 dark:text-red-400"
            )}
          >
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

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
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
      <header className="mb-8 flex flex-col gap-4 sm:mb-10">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit text-muted-foreground"
        >
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to dashboard
          </Link>
        </Button>
        <div>
          <h1 className={pageTitleClass}>Settings</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Manage your PackWise account, notifications, and privacy.
          </p>
        </div>
      </header>

      <div className="space-y-6">
        <SettingsSection
          icon={UserRound}
          title="Account"
          description="Your email and sign-in credentials."
        >
          <SettingsAccount email={email} />
        </SettingsSection>

        <SettingsSection
          icon={KeyRound}
          title="Password"
          description="Set or update the password you use to sign in."
        >
          <SettingsPassword email={email} />
        </SettingsSection>

        <SettingsSection
          icon={Bell}
          title="Notifications"
          description="Choose how PackWise can reach you about upcoming trips."
        >
          <SettingsNotifications
            showPackingReminder
            packingReminderEmail={packingReminderEmail}
            pushNotifications={pushNotifications}
          />
        </SettingsSection>

        <SettingsSection
          icon={Palette}
          title="Appearance"
          description="Theme and motion preferences for this device."
        >
          <SettingsAppearance />
        </SettingsSection>

        <SettingsSection
          icon={ShieldCheck}
          title="Privacy & Data"
          description="Export your data or review our policies."
        >
          <SettingsPrivacy />
        </SettingsSection>

        <SettingsSection
          icon={LogOut}
          title="Logout"
          description="Sign out of PackWise on this device."
        >
          <LogoutButton compact={false} variant="secondary" size="default" />
        </SettingsSection>

        <SettingsSection
          danger
          icon={Trash2}
          title="Delete account"
          description="Permanently remove your account, trips, packing lists, and related data. This cannot be undone."
        >
          <DeleteAccountButton />
        </SettingsSection>
      </div>
    </main>
  );
}
