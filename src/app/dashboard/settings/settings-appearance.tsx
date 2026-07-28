"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const REDUCED_MOTION_KEY = "packwise-reduced-motion";

export function applyReducedMotion(enabled: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (enabled) {
    root.setAttribute("data-reduced-motion", "true");
    localStorage.setItem(REDUCED_MOTION_KEY, "1");
  } else {
    root.removeAttribute("data-reduced-motion");
    localStorage.setItem(REDUCED_MOTION_KEY, "0");
  }
}

export function readReducedMotionPreference(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(REDUCED_MOTION_KEY) === "1";
}

const themes = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

export function SettingsAppearance() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setMounted(true);
    setReducedMotion(readReducedMotionPreference());
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <Label className="text-sm font-medium">Theme</Label>
        <div className="inline-flex rounded-md border border-border p-1">
          {themes.map((option) => {
            const active = mounted && theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={!mounted}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground">
          Choose light, dark, or match your device setting.
        </p>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="reduced-motion" className="text-sm font-medium">
            Reduced motion
          </Label>
          <p className="text-sm text-muted-foreground">
            Limit animations and page transition effects.
          </p>
        </div>
        <Switch
          id="reduced-motion"
          checked={reducedMotion}
          onCheckedChange={(checked) => {
            setReducedMotion(checked);
            applyReducedMotion(checked);
          }}
        />
      </div>
    </div>
  );
}
