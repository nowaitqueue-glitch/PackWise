"use client";

import { LayoutGroup } from "framer-motion";

export function DashboardLayoutGroup({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LayoutGroup id="dashboard-trips">{children}</LayoutGroup>;
}
