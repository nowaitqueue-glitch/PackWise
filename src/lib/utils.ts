import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Frosted glass surfaces over scenic / busy backgrounds.
 * Dark mode swaps to a translucent navy so text keeps its contrast.
 */
export const glassCard =
  "bg-white/70 backdrop-blur-md border border-white/30 rounded-2xl shadow-lg dark:bg-slate-950/85 dark:border-white/10"
export const glassCardHover =
  "hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
export const glassContentOverlay =
  "pointer-events-none absolute inset-0 rounded-[inherit] bg-white/25 dark:bg-slate-950/35"

/** Opaque panels over scenic trip backgrounds (packing, weather, etc.). */
export const solidContentCard =
  "rounded-2xl border border-border bg-white/80 shadow-lg dark:bg-gray-900/80"

/** Sticky headers / toolbars that float above scrolling content. */
export const glassHeader =
  "border-b border-white/40 bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:border-white/10 dark:bg-slate-950/70 supports-[backdrop-filter]:dark:bg-slate-950/55"

/**
 * Gradient-tinted tile sitting behind a lucide icon (hero features, auth forms,
 * section headers). Callers supply the size and radius.
 */
export const iconTileClass =
  "flex shrink-0 items-center justify-center bg-gradient-to-br from-brand-from/20 to-brand-to/20 text-brand-from shadow-sm ring-1 ring-inset ring-white/40 dark:from-brand-from/25 dark:to-brand-to/25 dark:text-brand-from dark:ring-white/10"

/** Smaller frosted chips (weather badges, meta pills). */
export const glassChip =
  "rounded-full border border-white/40 bg-white/60 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/60"

/** The primary travel gradient, for surfaces and for text. */
export const travelGradient = "bg-travel-gradient"
export const travelGradientText = "text-travel-gradient"

/** Shared field styling — mirrors ui/input + ui/select so bespoke triggers match. */
export const fieldClass =
  "w-full rounded-xl border border-gray-200 bg-white/60 px-4 py-3 text-base text-foreground shadow-sm outline-none backdrop-blur-sm transition-all placeholder:text-muted-foreground focus:border-transparent focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-slate-950/55 dark:text-foreground"

/** Icon inside destructive / delete icon buttons. */
export const deleteButtonIconClass =
  "transition-transform duration-200 group-hover:rotate-90"

/** Primary trip destination headings (dashboard cards + trip detail). */
export const tripTitleClass = "font-bold text-2xl tracking-tight"

/** Page + section headings. */
export const pageTitleClass =
  "text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
export const sectionTitleClass =
  "text-lg font-bold tracking-tight text-foreground"
