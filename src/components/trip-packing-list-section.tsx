"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TripPackingList } from "@/components/trip-packing-list";
import { TripPackingListSkeleton } from "@/components/trip-packing-list-skeleton";
import {
  parsePackingItems,
  parsePackingListSource,
  type PackingItem,
  type PackingListSource,
} from "@/lib/packing";
import { cn, glassChip } from "@/lib/utils";

const POLL_INTERVAL_MS = 1_500;
const POLL_TIMEOUT_MS = 45_000;

type TripPackingListSectionProps = {
  tripId: string;
  initialItems: PackingItem[];
  /** Custom items from packing_custom_items (merged into the checklist). */
  customItems?: PackingItem[];
  /** Owner-only; members can view but not regenerate. */
  canRegenerate?: boolean;
  /** Owner-only; members see read-only checkboxes. */
  canEdit?: boolean;
  /** How the stored list was generated. */
  listSource?: PackingListSource;
  /**
   * When true and the list is still empty, show a skeleton and poll until
   * items appear (or timeout → regenerate CTA).
   */
  expectPending?: boolean;
};

type LoadState = "ready" | "pending" | "failed";

export function TripPackingListSection({
  tripId,
  initialItems,
  customItems = [],
  canRegenerate = true,
  canEdit = true,
  listSource,
  expectPending = false,
}: TripPackingListSectionProps) {
  const [items, setItems] = useState(initialItems);
  const [source, setSource] = useState(listSource);
  const [loadState, setLoadState] = useState<LoadState>(() => {
    if (initialItems.length > 0) return "ready";
    if (expectPending) return "pending";
    return "ready";
  });

  useEffect(() => {
    setItems(initialItems);
    setSource(listSource);
    if (initialItems.length > 0) {
      setLoadState("ready");
    } else if (expectPending) {
      setLoadState((current) => (current === "failed" ? current : "pending"));
    }
  }, [initialItems, listSource, expectPending]);

  useEffect(() => {
    if (loadState !== "pending") {
      return;
    }

    let cancelled = false;
    const supabase = createClient();
    const startedAt = Date.now();

    async function pollOnce(): Promise<boolean> {
      const { data, error } = await supabase
        .from("packing_lists")
        .select("items")
        .eq("trip_id", tripId)
        .maybeSingle();

      if (cancelled) return true;
      if (error) {
        return false;
      }

      const nextItems = parsePackingItems(data?.items);
      if (nextItems.length === 0) {
        return false;
      }

      const nextSource =
        parsePackingListSource(data?.items) ??
        (nextItems.length > 0 ? "template" : undefined);
      setItems(nextItems);
      setSource(nextSource);
      setLoadState("ready");
      return true;
    }

    void pollOnce();

    const intervalId = window.setInterval(() => {
      void (async () => {
        const done = await pollOnce();
        if (done || cancelled) {
          return;
        }
        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
          setLoadState("failed");
        }
      })();
    }, POLL_INTERVAL_MS);

    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        setLoadState((current) => (current === "pending" ? "failed" : current));
      }
    }, POLL_TIMEOUT_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [loadState, tripId]);

  if (loadState === "pending") {
    return (
      <div className="flex flex-col gap-3">
        <p
          className={cn(
            "flex w-fit items-center gap-2 px-3 py-1.5 text-sm font-semibold text-foreground",
            glassChip
          )}
          aria-live="polite"
          data-testid="packing-list-generating"
        >
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
          Generating…
        </p>
        <TripPackingListSkeleton />
      </div>
    );
  }

  return (
    <TripPackingList
      tripId={tripId}
      items={items}
      customItems={customItems}
      canRegenerate={canRegenerate}
      canEdit={canEdit}
      listSource={source}
    />
  );
}
