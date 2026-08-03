"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
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
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
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
    <div className="divide-y divide-slate-900/5 dark:divide-white/10">
      <div className="space-y-3 py-4 first:pt-0 last:pb-0">
        <Label id="theme-group-label">Theme</Label>
        <div
          role="group"
          aria-labelledby="theme-group-label"
          className="flex w-full max-w-sm gap-1 rounded-xl border border-gray-200 bg-white/60 p-1 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/50"
        >
          {themes.map((option) => {
            const active = mounted && theme === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                disabled={!mounted}
                aria-pressed={active}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 disabled:opacity-60",
                  active
                    ? "bg-travel-gradient text-white shadow-md"
                    : "text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-white/10"
                )}
              >
                <Icon className="size-4" aria-hidden />
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground">
          Choose light, dark, or match your device setting.
        </p>
      </div>

      <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="reduced-motion">Reduced motion</Label>
          <p className="text-sm text-muted-foreground">
            Limit animations and page transition effects.
          </p>
        </div>
        <Switch
          id="reduced-motion"
          className="mt-0.5 shrink-0"
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
