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
    param: "upgrade",
    value: "success",
    message: "Welcome to PackWise Pro!",
    variant: "success",
  },
  {
    param: "upgrade",
    value: "canceled",
    message: "Upgrade canceled.",
    variant: "info",
  },
  {
    param: "password_reset",
    value: "1",
    message: "Password updated successfully.",
    variant: "success",
  },
];

/**
 * Reads one-shot query params (e.g. after redirects) and shows a pill banner,
 * then strips the param from the URL without a full navigation.
 */
export function SearchParamsBanner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { showBanner } = usePillBanner();
  const handledKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const upgrade = searchParams.get("upgrade");
    const message = searchParams.get("message");

    if (upgrade === "error" && message) {
      const key = `upgrade:error:${message}`;
      if (handledKeyRef.current === key) return;
      handledKeyRef.current = key;
      showBanner({ message, variant: "error" });
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
