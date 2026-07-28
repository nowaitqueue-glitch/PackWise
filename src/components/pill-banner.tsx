"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type PillBannerVariant = "success" | "error" | "info";

export type PillBannerState = {
  id: number;
  message: string;
  variant: PillBannerVariant;
};

type PillBannerProps = {
  banner: PillBannerState | null;
};

const variantStyles: Record<PillBannerVariant, string> = {
  success:
    "border-emerald-500/30 bg-emerald-500/15 text-emerald-950 dark:text-emerald-50",
  error: "border-red-500/30 bg-red-500/15 text-red-950 dark:text-red-50",
  info: "border-sky-500/25 bg-sky-500/10 text-foreground",
};

export function PillBanner({ banner }: PillBannerProps) {
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
              "pointer-events-auto max-w-lg rounded-full border px-6 py-2.5 text-center text-sm font-medium shadow-lg backdrop-blur-md",
              variantStyles[banner.variant]
            )}
          >
            {banner.message}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
