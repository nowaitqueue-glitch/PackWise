"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  EVENTS,
  Joyride,
  STATUS,
  type EventData,
  type Step,
} from "react-joyride";
import { markOnboardingSeen } from "@/app/dashboard/onboarding-actions";

type DashboardOnboardingProps = {
  /** Full 3-step tour only when the user already has at least one trip. */
  hasTrips: boolean;
};

function readCssHsl(varName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return raw ? `hsl(${raw})` : fallback;
}

export function DashboardOnboarding({ hasTrips }: DashboardOnboardingProps) {
  const { resolvedTheme } = useTheme();
  const markedRef = useRef(false);
  const [run, setRun] = useState(false);
  const [stylesReady, setStylesReady] = useState(false);
  const [tourStyles, setTourStyles] = useState({
    backgroundColor: "#ffffff",
    textColor: "#171717",
    primaryColor: "#171717",
    overlayColor: "rgba(0, 0, 0, 0.45)",
  });

  useEffect(() => {
    // Defer start until targets are in the DOM after hydration.
    const id = window.requestAnimationFrame(() => setRun(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const isDark = resolvedTheme === "dark";
    setTourStyles({
      backgroundColor: readCssHsl("--popover", isDark ? "#18181b" : "#ffffff"),
      textColor: readCssHsl(
        "--popover-foreground",
        isDark ? "#fafafa" : "#171717"
      ),
      primaryColor: readCssHsl("--primary", isDark ? "#fafafa" : "#171717"),
      overlayColor: isDark ? "rgba(0, 0, 0, 0.65)" : "rgba(0, 0, 0, 0.4)",
    });
    setStylesReady(true);
  }, [resolvedTheme]);

  const persistSeen = useCallback(() => {
    if (markedRef.current) return;
    markedRef.current = true;
    void markOnboardingSeen();
  }, []);

  const steps = useMemo<Step[]>(() => {
    const newTripTarget = '[data-tour="onboarding-new-trip"]';

    // Empty dashboard: one clear CTA — do not reuse the New trip target for
    // forecast/packing steps (that looked like the same tip repeating).
    if (!hasTrips) {
      return [
        {
          target: newTripTarget,
          title: "Create your first trip",
          content:
            "Tap Create your first trip to plan a getaway and start packing smarter.",
          placement: "bottom",
        },
      ];
    }

    return [
      {
        target: newTripTarget,
        title: "New trip",
        content:
          "Click New trip to plan a getaway and start packing smarter.",
        placement: "bottom",
      },
      {
        target: '[data-tour="onboarding-forecast"]',
        title: "Check the forecast",
        content:
          "Weather for upcoming trips shows on each card — open a trip for the full forecast.",
        placement: "top",
      },
      {
        target: '[data-tour="onboarding-packing"]',
        title: "Get your packing list",
        content:
          "Open a trip to see your personalized packing list and check items off as you pack.",
        placement: "top",
      },
    ];
  }, [hasTrips]);

  const handleEvent = useCallback(
    (data: EventData) => {
      const ended =
        data.type === EVENTS.TOUR_END ||
        data.status === STATUS.FINISHED ||
        data.status === STATUS.SKIPPED;

      if (ended) {
        persistSeen();
        setRun(false);
      }
    },
    [persistSeen]
  );

  if (!stylesReady) {
    return null;
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      locale={{
        back: "Back",
        close: "Close",
        last: "Done",
        next: "Next",
        skip: "Skip",
      }}
      options={{
        buttons: ["back", "skip", "primary"],
        closeButtonAction: "skip",
        skipBeacon: true,
        showProgress: true,
        blockTargetInteraction: false,
        overlayClickAction: false,
        backgroundColor: tourStyles.backgroundColor,
        textColor: tourStyles.textColor,
        primaryColor: tourStyles.primaryColor,
        arrowColor: tourStyles.backgroundColor,
        overlayColor: tourStyles.overlayColor,
        spotlightRadius: 8,
        zIndex: 10000,
      }}
      styles={{
        tooltip: {
          borderRadius: 12,
          padding: 16,
        },
        tooltipTitle: {
          fontSize: 16,
          fontWeight: 600,
          marginBottom: 6,
        },
        tooltipContent: {
          fontSize: 14,
          lineHeight: 1.45,
          padding: "4px 0 8px",
        },
        buttonPrimary: {
          borderRadius: 8,
          fontSize: 13,
          padding: "8px 14px",
        },
        buttonBack: {
          borderRadius: 8,
          fontSize: 13,
          marginRight: 8,
        },
        buttonSkip: {
          fontSize: 13,
        },
      }}
    />
  );
}
