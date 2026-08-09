"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { regeneratePackingList, updatePackingItemPacked } from "@/app/dashboard/packing-actions";
import {
  createCustomPackingItem,
  deleteCustomPackingItem,
  updateCustomPackingItem,
  updateCustomPackingItemPacked,
} from "@/app/dashboard/packing-custom-actions";
import {
  emptyCustomForm,
  PackingListView,
  type CustomFormState,
} from "@/components/packing-list-view";
import { usePillBanner } from "@/components/pill-banner-provider";
import { type PackingItem } from "@/lib/packing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type TripPackingListProps = {
  tripId: string;
  items: PackingItem[];
  /** Custom items from packing_custom_items (merged into the checklist). */
  customItems?: PackingItem[];
  /** Owner-only; members can view but not regenerate. */
  canRegenerate?: boolean;
  /** Owner-only; members see read-only checkboxes. */
  canEdit?: boolean;
};

function mergeDisplayItems(
  generated: PackingItem[],
  custom: PackingItem[]
): PackingItem[] {
  return [
    ...generated.map((item) => ({ ...item, isCustom: false as const })),
    ...custom.map((item) => ({ ...item, isCustom: true as const })),
  ];
}

export function TripPackingList({
  tripId,
  items,
  customItems = [],
  canRegenerate = true,
  canEdit = true,
}: TripPackingListProps) {
  const { showBanner } = usePillBanner();
  const [localItems, setLocalItems] = useState(() =>
    mergeDisplayItems(items, customItems)
  );
  const [isRegenerating, startRegenerate] = useTransition();
  const [isMutating, startMutate] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<CustomFormState>(emptyCustomForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CustomFormState>(emptyCustomForm);

  useEffect(() => {
    setLocalItems(mergeDisplayItems(items, customItems));
  }, [items, customItems]);

  function handleRegenerate() {
    startRegenerate(async () => {
      const result = await regeneratePackingList(tripId);
      if (!result.ok) {
        showBanner({ message: result.error, variant: "error" });
        return;
      }
      setLocalItems((current) => {
        const custom = current.filter((item) => item.isCustom);
        return mergeDisplayItems(result.items, custom);
      });
      showBanner({ message: "Packing list regenerated.", variant: "success" });
    });
  }

  function handleToggle(item: PackingItem, itemIndex: number, packed: boolean) {
    if (!canEdit) {
      return;
    }

    // F7: prefer stable id; never fall back to index when id was provided but missing.
    if (item.id) {
      const byId = localItems.findIndex((entry) => entry.id === item.id);
      if (byId < 0) {
        console.warn("Item not found:", item.id);
        return;
      }
    }

    const previous = localItems;
    setLocalItems((current) =>
      current.map((entry, index) => {
        if (item.id) {
          return entry.id === item.id ? { ...entry, packed } : entry;
        }
        return index === itemIndex ? { ...entry, packed } : entry;
      })
    );

    startMutate(async () => {
      const result = item.isCustom
        ? await updateCustomPackingItemPacked({
            tripId,
            itemId: item.id!,
            packed,
          })
        : await updatePackingItemPacked({
            tripId,
            ...(item.id
              ? { itemId: item.id }
              : {
                  itemIndex: localItems
                    .slice(0, itemIndex)
                    .filter((entry) => !entry.isCustom).length,
                }),
            packed,
          });

      if (!result.ok) {
        setLocalItems(previous);
        showBanner({ message: result.error, variant: "error" });
      }
    });
  }

  function handleAddSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit || !addForm.name.trim()) {
      return;
    }

    startMutate(async () => {
      const result = await createCustomPackingItem({
        tripId,
        name: addForm.name,
        category: addForm.category,
        notes: addForm.notes,
      });
      if (!result.ok) {
        showBanner({ message: result.error, variant: "error" });
        return;
      }
      setLocalItems((current) => [...current, result.item]);
      setAddForm(emptyCustomForm());
      setShowAddForm(false);
      showBanner({ message: "Custom item added.", variant: "success" });
    });
  }

  function startEdit(item: PackingItem) {
    if (!item.id || !item.isCustom) return;
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      category: item.category,
      notes: item.notes,
    });
    setShowAddForm(false);
  }

  function handleEditSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit || !editingId || !editForm.name.trim()) {
      return;
    }

    startMutate(async () => {
      const result = await updateCustomPackingItem({
        tripId,
        itemId: editingId,
        name: editForm.name,
        category: editForm.category,
        notes: editForm.notes,
      });
      if (!result.ok) {
        showBanner({ message: result.error, variant: "error" });
        return;
      }
      setLocalItems((current) =>
        current.map((entry) =>
          entry.id === editingId && entry.isCustom ? result.item : entry
        )
      );
      setEditingId(null);
      showBanner({ message: "Custom item updated.", variant: "success" });
    });
  }

  function handleDelete(item: PackingItem) {
    if (!canEdit || !item.isCustom || !item.id) {
      return;
    }

    const previous = localItems;
    setLocalItems((current) =>
      current.filter((entry) => !(entry.isCustom && entry.id === item.id))
    );
    if (editingId === item.id) {
      setEditingId(null);
    }

    startMutate(async () => {
      const result = await deleteCustomPackingItem({
        tripId,
        itemId: item.id!,
      });
      if (!result.ok) {
        setLocalItems(previous);
        showBanner({ message: result.error, variant: "error" });
      }
    });
  }

  const hasItems = localItems.length > 0;
  const busy = isRegenerating || isMutating;

  const description = hasItems ? (
    canEdit ? (
      "Weather-aware checklist for this trip type"
    ) : (
      <>
        <span className="block">
          Shared view-only list — your travel buddies can see what you’re
          bringing and pack alongside you.
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <span>Live collaborative check-offs</span>
          <Badge variant="secondary">Coming soon</Badge>
        </span>
      </>
    )
  ) : (
    "No packing list yet — generate one to get started"
  );

  const emptyMessage = canRegenerate
    ? "Packing list generation may have failed. Use Regenerate to try again."
    : "No packing list yet. Ask the trip owner to generate one.";

  return (
    <PackingListView
      items={localItems}
      celebrationKey={tripId}
      readOnly={!canEdit}
      disabled={isRegenerating}
      busy={busy}
      description={description}
      headerActions={
        canRegenerate ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={handleRegenerate}
            disabled={busy}
            aria-label="Regenerate packing list"
            data-testid="packing-regenerate"
          >
            {isRegenerating ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <RefreshCw aria-hidden />
            )}
            {isRegenerating ? "Generating…" : "Regenerate"}
          </Button>
        ) : null
      }
      emptyMessage={emptyMessage}
      onTogglePacked={handleToggle}
      canManageCustom={canEdit}
      editingId={editingId}
      editForm={editForm}
      onEditFormChange={setEditForm}
      onEditSubmit={handleEditSubmit}
      onEditCancel={() => setEditingId(null)}
      onStartEdit={startEdit}
      onDeleteCustom={handleDelete}
      showAddForm={showAddForm}
      addForm={addForm}
      onAddFormChange={setAddForm}
      onAddSubmit={handleAddSubmit}
      onAddCancel={() => {
        setShowAddForm(false);
        setAddForm(emptyCustomForm());
      }}
      onShowAddForm={() => {
        setEditingId(null);
        setShowAddForm(true);
      }}
      testId="packing-list"
    />
  );
}
