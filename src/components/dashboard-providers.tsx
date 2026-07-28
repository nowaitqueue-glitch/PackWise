"use client";

import { Suspense } from "react";
import { PillBannerProvider } from "@/components/pill-banner-provider";
import { SearchParamsBanner } from "@/components/search-params-banner";

export function DashboardProviders({ children }: { children: React.ReactNode }) {
  return (
    <PillBannerProvider>
      <Suspense fallback={null}>
        <SearchParamsBanner />
      </Suspense>
      {children}
    </PillBannerProvider>
  );
}
