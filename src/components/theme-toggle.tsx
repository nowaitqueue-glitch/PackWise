"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  /** `light` = white icon chrome for dark/gradient landing headers. */
  variant?: "light" | "default";
};

export function ThemeToggle({
  className,
  variant = "default",
}: ThemeToggleProps = {}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const lightChrome =
    variant === "light" &&
    "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] hover:bg-white/10 hover:text-white";

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "min-h-11 min-w-11 rounded-full p-2",
          lightChrome,
          className
        )}
        aria-label="Toggle theme"
        disabled
      >
        <Sun className="size-4" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "min-h-11 min-w-11 rounded-full p-2",
        lightChrome,
        className
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
