'use client';

export function ShopEssentialsCard() {
  return (
    <div className="mt-8 rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/10 p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🧳</span>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Stock up on travel essentials
          </h4>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
            We&apos;ve curated a list of the best travel gear, from packing cubes to adapters, all in one place.
          </p>
          <a
            href="https://www.amazon.com/shop/packwise/list/PLACEHOLDER"
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-amber-800 dark:text-amber-100 hover:text-amber-900 dark:hover:text-amber-50 transition-colors"
          >
            Browse on Amazon
            <span className="text-xs">&rarr;</span>
          </a>
        </div>
      </div>
    </div>
  );
}