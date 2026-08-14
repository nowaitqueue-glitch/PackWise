"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PillBanner,
  type PillBannerState,
  type PillBannerVariant,
} from "@/components/pill-banner";

export type ShowBannerOptions = {
  message: string;
  variant?: PillBannerVariant;
  /** Auto-dismiss delay in ms; defaults to 3500. Set 0 to keep visible until replaced. */
  duration?: number;
  /** Optional action (e.g. Undo) shown next to the message. */
  action?: {
    label: string;
    onClick: () => void;
  };
};

type PillBannerContextValue = {
  showBanner: (options: ShowBannerOptions) => void;
  dismissBanner: () => void;
};

const PillBannerContext = createContext<PillBannerContextValue | null>(null);

const DEFAULT_DURATION_MS = 3500;

export function PillBannerProvider({ children }: { children: React.ReactNode }) {
  const [banner, setBanner] = useState<PillBannerState | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextIdRef = useRef(0);
  const actionRef = useRef<(() => void) | null>(null);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const dismissBanner = useCallback(() => {
    clearDismissTimer();
    actionRef.current = null;
    setBanner(null);
  }, [clearDismissTimer]);

  const showBanner = useCallback(
    ({
      message,
      variant = "info",
      duration = DEFAULT_DURATION_MS,
      action,
    }: ShowBannerOptions) => {
      clearDismissTimer();
      nextIdRef.current += 1;
      actionRef.current = action?.onClick ?? null;
      setBanner({
        id: nextIdRef.current,
        message,
        variant,
        ...(action?.label ? { actionLabel: action.label } : {}),
      });

      if (duration > 0) {
        dismissTimerRef.current = setTimeout(() => {
          actionRef.current = null;
          setBanner(null);
          dismissTimerRef.current = null;
        }, duration);
      }
    },
    [clearDismissTimer]
  );

  const handleAction = useCallback(() => {
    const onClick = actionRef.current;
    dismissBanner();
    onClick?.();
  }, [dismissBanner]);

  useEffect(() => clearDismissTimer, [clearDismissTimer]);

  const value = useMemo(
    () => ({ showBanner, dismissBanner }),
    [showBanner, dismissBanner]
  );

  return (
    <PillBannerContext.Provider value={value}>
      {children}
      <PillBanner banner={banner} onAction={handleAction} />
    </PillBannerContext.Provider>
  );
}

export function usePillBanner(): PillBannerContextValue {
  const context = useContext(PillBannerContext);
  if (!context) {
    throw new Error("usePillBanner must be used within PillBannerProvider");
  }
  return context;
}
