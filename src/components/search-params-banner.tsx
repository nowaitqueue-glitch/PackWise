"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePillBanner } from "@/components/pill-banner-provider";

type BannerRule = {
  param: string;
  value: string;
  message: string;
  variant: "success" | "error" | "info";
};

const RULES: BannerRule[] = [
  {
    param: "created",
    value: "1",
    message: "Trip created successfully.",
    variant: "success",
  },
  {
    param: "duplicated",
    value: "1",
    message: "Trip duplicated.",
    variant: "success",
  },
  {
    param: "updated",
    value: "1",
    message: "Trip updated.",
    variant: "success",
  },
  {
    param: "password_reset",
    value: "1",
    message: "Password updated successfully.",
    variant: "success",
  },
  {
    param: "claim_warning",
    value: "1",
    message:
      "Trip saved, but some custom packing items could not be transferred. You can add them again from this page.",
    variant: "info",
  },
];

/**
 * Reads one-shot query params (e.g. after redirects) and shows a pill banner,
 * then strips the param from the URL without a full navigation.
 * Upgrade/Pro checkout banners are intentionally omitted (Pro Coming Soon).
 */
export function SearchParamsBanner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { showBanner } = usePillBanner();
  const handledKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // Strip legacy upgrade query noise without showing Pro upgrade banners.
    if (searchParams.get("upgrade")) {
      const key = `upgrade:strip:${pathname}`;
      if (handledKeyRef.current === key) return;
      handledKeyRef.current = key;
      router.replace(pathname, { scroll: false });
      return;
    }

    for (const rule of RULES) {
      if (searchParams.get(rule.param) !== rule.value) continue;

      const key = `${rule.param}:${rule.value}:${pathname}`;
      if (handledKeyRef.current === key) return;
      handledKeyRef.current = key;

      showBanner({ message: rule.message, variant: rule.variant });
      router.replace(pathname, { scroll: false });
      return;
    }
  }, [pathname, router, searchParams, showBanner]);

  return null;
}
