"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { regeneratePackingList } from "@/app/dashboard/packing-actions";
import { TripPackingListSkeleton } from "@/components/trip-packing-list-skeleton";
import { type PackingItem } from "@/lib/packing";
import { cn, glassChip } from "@/lib/utils";

const TripPackingList = dynamic(
  () =>
    import("@/components/trip-packing-list").then((m) => ({
      default: m.TripPackingList,
    })),
  {
    loading: () => <TripPackingListSkeleton />,
  }
);

/** Auto-generate only for trips created within this window. */
const AUTO_GENERATE_MAX_AGE_MS = 5 * 60 * 1000;

type TripPackingListSectionProps = {
  tripId: string;
  initialItems: PackingItem[];
  /** Custom items from packing_custom_items (merged into the checklist). */
  customItems?: PackingItem[];
  /** Owner-only; members can view but not regenerate. */
  canRegenerate?: boolean;
  /** Owner-only; members see read-only checkboxes. */
  canEdit?: boolean;
  /**
   * When true and the list is still empty, kick off the same generate action
   * as the manual Regenerate button (used after create/duplicate redirects).
   */
  expectPending?: boolean;
  /** ISO timestamp from trips.created_at — enables the ~5 minute auto-gen window. */
  tripCreatedAt?: string | null;
};

type LoadState = "ready" | "pending" | "failed";

function isRecentlyCreated(tripCreatedAt: string | null | undefined): boolean {
  if (!tripCreatedAt) return false;
  const createdMs = Date.parse(tripCreatedAt);
  if (!Number.isFinite(createdMs)) return false;
  return Date.now() - createdMs <= AUTO_GENERATE_MAX_AGE_MS;
}

export function TripPackingListSection({
  tripId,
  initialItems,
  customItems = [],
  canRegenerate = true,
  canEdit = true,
  expectPending = false,
  tripCreatedAt = null,
}: TripPackingListSectionProps) {
  const shouldAutoGenerate =
    canRegenerate &&
    initialItems.length === 0 &&
    (expectPending || isRecentlyCreated(tripCreatedAt));

  const [items, setItems] = useState(initialItems);
  const [loadState, setLoadState] = useState<LoadState>(() =>
    shouldAutoGenerate ? "pending" : "ready"
  );

  useEffect(() => {
    setItems(initialItems);
    if (initialItems.length > 0) {
      setLoadState("ready");
      return;
    }
    if (shouldAutoGenerate) {
      // Preserve failure so we do not retry in a loop after a failed attempt.
      setLoadState((current) => (current === "failed" ? current : "pending"));
    }
  }, [initialItems, shouldAutoGenerate]);

  useEffect(() => {
    if (loadState !== "pending" || !canRegenerate) {
      return;
    }

    console.info("[packing] client auto-generate start", { tripId });

    // Same server action as the Regenerate button. No cancel flag: Strict Mode
    // remounts must still land a result (upsert is idempotent if run twice).
    void regeneratePackingList(tripId).then((result) => {
      if (!result.ok) {
        console.error("[packing] client auto-generate failed", {
          tripId,
          error: result.error,
        });
        setLoadState("failed");
        return;
      }

      console.info("[packing] client auto-generate success", {
        tripId,
        itemCount: result.items.length,
        source: result.source,
      });
      setItems(result.items);
      setLoadState("ready");
    });
  }, [loadState, tripId, canRegenerate]);

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
          Generating your packing list...
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
    />
  );
}
