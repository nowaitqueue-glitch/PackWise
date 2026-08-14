"use client";

type SettingsNotificationsProps = {
  showPackingReminder: boolean;
  packingReminderEmail: boolean;
  pushNotifications: boolean;
};

/**
 * Notification prefs UI. Packing reminders and push are Coming Soon —
 * no working toggles until Resend / push delivery ship.
 */
export function SettingsNotifications(_props: SettingsNotificationsProps) {
  return (
    <div className="divide-y divide-slate-900/5 dark:divide-white/10">
      <div className="space-y-1 py-4 first:pt-0 last:pb-0">
        <p className="text-sm font-medium text-foreground">
          Packing reminder email
        </p>
        <p className="text-sm text-muted-foreground">
          Get an email before upcoming trips so you can finish packing.
        </p>
        <p className="text-sm italic text-muted-foreground">Coming Soon</p>
      </div>

      <div className="space-y-1 py-4 first:pt-0 last:pb-0">
        <p className="text-sm font-medium text-foreground">
          Push notifications
        </p>
        <p className="text-sm text-muted-foreground">
          Allow browser notifications when PackWise has trip updates.
        </p>
        <p className="text-sm italic text-muted-foreground">Coming Soon</p>
      </div>
    </div>
  );
}
