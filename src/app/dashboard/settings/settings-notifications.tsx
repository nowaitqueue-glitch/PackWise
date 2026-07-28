"use client";

import { useState, useTransition } from "react";
import { usePillBanner } from "@/components/pill-banner-provider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateNotificationPrefs } from "./settings-actions";

type SettingsNotificationsProps = {
  showPackingReminder: boolean;
  packingReminderEmail: boolean;
  pushNotifications: boolean;
};

export function SettingsNotifications({
  showPackingReminder,
  packingReminderEmail: initialPackingReminder,
  pushNotifications: initialPush,
}: SettingsNotificationsProps) {
  const { showBanner } = usePillBanner();
  const [packingReminder, setPackingReminder] = useState(initialPackingReminder);
  const [pushEnabled, setPushEnabled] = useState(initialPush);
  const [isPending, startTransition] = useTransition();

  function savePrefs(next: {
    packingReminderEmail?: boolean;
    pushNotifications?: boolean;
  }) {
    startTransition(async () => {
      const result = await updateNotificationPrefs(next);
      if (!result.ok) {
        showBanner({ message: result.error, variant: "error" });
        if (typeof next.packingReminderEmail === "boolean") {
          setPackingReminder(!next.packingReminderEmail);
        }
        if (typeof next.pushNotifications === "boolean") {
          setPushEnabled(!next.pushNotifications);
        }
        return;
      }
      showBanner({ message: "Preferences saved.", variant: "success" });
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {showPackingReminder ? (
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="packing-reminder" className="text-sm font-medium">
              Packing reminder email
            </Label>
            <p className="text-sm text-muted-foreground">
              Get an email before upcoming trips so you can finish packing.
            </p>
          </div>
          <Switch
            id="packing-reminder"
            checked={packingReminder}
            disabled={isPending}
            onCheckedChange={(checked) => {
              setPackingReminder(checked);
              savePrefs({ packingReminderEmail: checked });
            }}
          />
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="push-notifications" className="text-sm font-medium">
            Push notifications
          </Label>
          <p className="text-sm text-muted-foreground">
            Allow browser notifications when PackWise has trip updates. Your
            browser may still ask for permission.
          </p>
        </div>
        <Switch
          id="push-notifications"
          checked={pushEnabled}
          disabled={isPending}
          onCheckedChange={(checked) => {
            startTransition(async () => {
              if (checked && typeof window !== "undefined" && "Notification" in window) {
                try {
                  const permission = await Notification.requestPermission();
                  if (permission === "denied") {
                    setPushEnabled(false);
                    showBanner({
                      message:
                        "Notification permission was denied in your browser.",
                      variant: "error",
                    });
                    return;
                  }
                } catch {
                  // Permission API unavailable — still store preference.
                }
              }

              setPushEnabled(checked);
              const result = await updateNotificationPrefs({
                pushNotifications: checked,
              });
              if (!result.ok) {
                setPushEnabled(!checked);
                showBanner({ message: result.error, variant: "error" });
                return;
              }
              showBanner({ message: "Preferences saved.", variant: "success" });
            });
          }}
        />
      </div>
    </div>
  );
}
