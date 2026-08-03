"use client";

import { useEffect, useState } from "react";
import { PackingListView } from "@/components/packing-list-view";
import type { PackingItem } from "@/lib/packing";
import { setGuestItemPacked } from "@/lib/guest-storage";
import { Badge } from "@/components/ui/badge";

type GuestPackingListProps = {
  initialItems: PackingItem[];
  onPackedChange?: () => void;
};

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
      onPackedChange?.();
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
