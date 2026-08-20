"use client";

import { cn, glassCardHover, solidContentCard } from "@/lib/utils";

/**
 * Curated Amazon list CTA. Hidden until NEXT_PUBLIC_AMAZON_LIST_URL is set
 * (see .env.example). Global footer already carries the Associate disclosure.
 */
export function ShopEssentialsCard() {
  const SHOP_URL = process.env.NEXT_PUBLIC_AMAZON_LIST_URL?.trim();
  if (!SHOP_URL) return null;

  return (
    <div
      className={cn(
        "mt-8 p-5",
        solidContentCard,
        glassCardHover,
        "border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50 dark:border-amber-700/40 dark:from-amber-950/50 dark:to-orange-950/35"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          🧳
        </span>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Stock up on travel essentials
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-amber-700 dark:text-amber-200/90">
            We&apos;ve curated a list of the best travel gear, from packing cubes
            to adapters, all in one place.
          </p>
          <a
            href={SHOP_URL}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-amber-800 transition-colors hover:text-amber-900 dark:text-amber-100 dark:hover:text-white"
          >
            Browse on Amazon
            <span className="text-xs">&rarr;</span>
          </a>
        </div>
      </div>
    </div>
  );
}
