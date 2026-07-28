"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

function applyStoredReducedMotion() {
  try {
    if (localStorage.getItem("packwise-reduced-motion") === "1") {
      document.documentElement.setAttribute("data-reduced-motion", "true");
    }
  } catch {
    // Ignore storage errors (private mode, etc.).
  }
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  React.useEffect(() => {
    applyStoredReducedMotion();
  }, []);

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
