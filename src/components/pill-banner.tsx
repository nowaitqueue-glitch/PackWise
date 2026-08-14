"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type PillBannerVariant = "success" | "error" | "info";

export type PillBannerState = {
  id: number;
  message: string;
  variant: PillBannerVariant;
  actionLabel?: string;
};

type PillBannerProps = {
  banner: PillBannerState | null;
  onAction?: () => void;
};

const variantStyles: Record<PillBannerVariant, string> = {
  success:
    "border-emerald-500/30 bg-emerald-500/15 text-emerald-950 dark:text-emerald-50",
  error: "border-red-500/30 bg-red-500/15 text-red-950 dark:text-red-50",
  info: "border-sky-500/25 bg-sky-500/10 text-foreground",
};

export function PillBanner({ banner, onAction }: PillBannerProps) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4"
    >
      <AnimatePresence mode="wait">
        {banner ? (
          <motion.div
            key={banner.id}
            role="status"
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className={cn(
              "pointer-events-auto flex max-w-lg items-center gap-3 rounded-full border px-5 py-2.5 text-sm font-medium shadow-lg backdrop-blur-md",
              variantStyles[banner.variant]
            )}
          >
            <span className="min-w-0 flex-1 text-center">{banner.message}</span>
            {banner.actionLabel && onAction ? (
              <button
                type="button"
                className="shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold underline-offset-2 transition-opacity hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={onAction}
                data-testid="pill-banner-action"
              >
                {banner.actionLabel}
              </button>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
