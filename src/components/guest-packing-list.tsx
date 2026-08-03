"use client";

import { useEffect, useState } from "react";
import { PackingListView } from "@/components/packing-list-view";
import type { PackingItem } from "@/lib/packing";
import {
  setGuestItemPacked,
  syncGuestCheckoffCount,
} from "@/lib/guest-storage";
import { Badge } from "@/components/ui/badge";

export type GuestPackedStats = {
  checkoffCount: number;
  packedCount: number;
  totalCount: number;
};

type GuestPackingListProps = {
  initialItems: PackingItem[];
  onPackedChange?: (stats: GuestPackedStats) => void;
};

function statsFromItems(items: PackingItem[]): GuestPackedStats {
  const packedCount = items.reduce((n, item) => n + (item.packed ? 1 : 0), 0);
  return {
    checkoffCount: packedCount,
    packedCount,
    totalCount: items.length,
  };
}

export function GuestPackingList({
  initialItems,
  onPackedChange,
}: GuestPackingListProps) {
  const [items, setItems] = useState(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  function handleToggle(item: PackingItem, index: number, packed: boolean) {
    setItems((prev) => {
      const next = prev.map((row, i) =>
        i === index ? { ...row, packed } : row
      );
      setGuestItemPacked(item.name, packed);
      const checkoffCount = syncGuestCheckoffCount(next);
      const stats = statsFromItems(next);
      onPackedChange?.({ ...stats, checkoffCount });
      return next;
    });
  }

  return (
    <PackingListView
      items={items}
      celebrationKey="guest"
      readOnly={false}
      titleBadge={<Badge variant="secondary">Guest</Badge>}
      description="Checkoffs stay in this browser until you create an account."
      emptyMessage="No packing items yet."
      onTogglePacked={handleToggle}
      canManageCustom={false}
      testId="guest-packing-list"
    />
  );
}
