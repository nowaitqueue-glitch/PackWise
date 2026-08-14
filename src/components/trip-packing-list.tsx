"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import {
  deletePackingItem,
  deletePackingItems,
  regeneratePackingList,
  restorePackingItem,
  updatePackingItemPacked,
} from "@/app/dashboard/packing-actions";
import {
  createCustomPackingItem,
  deleteCustomPackingItem,
  restoreCustomPackingItem,
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

const UNDO_BANNER_MS = 5000;

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

function insertAtIndex(
  items: PackingItem[],
  item: PackingItem,
  index: number
): PackingItem[] {
  const at = Math.max(0, Math.min(index, items.length));
  return [...items.slice(0, at), item, ...items.slice(at)];
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

  function handleUndoRemove(
    item: PackingItem,
    displayIndex: number,
    generatedIndex: number
  ) {
    setLocalItems((current) => {
      const alreadyThere = item.id
        ? current.some((entry) => entry.id === item.id)
        : false;
      if (alreadyThere) return current;
      return insertAtIndex(current, { ...item }, displayIndex);
    });

    startMutate(async () => {
      if (item.isCustom) {
        const result = await restoreCustomPackingItem({
          tripId,
          item: {
            id: item.id,
            name: item.name,
            category: item.category,
            notes: item.notes,
            packed: item.packed,
          },
        });
        if (!result.ok) {
          setLocalItems((current) =>
            current.filter((entry) =>
              item.id ? entry.id !== item.id : true
            )
          );
          showBanner({ message: result.error, variant: "error" });
          return;
        }
        setLocalItems((current) =>
          current.map((entry) =>
            entry.id === result.item.id && entry.isCustom ? result.item : entry
          )
        );
        return;
      }

      const result = await restorePackingItem({
        tripId,
        item: { ...item, isCustom: false },
        index: generatedIndex,
      });
      if (!result.ok) {
        setLocalItems((current) =>
          current.filter((entry) => (item.id ? entry.id !== item.id : true))
        );
        showBanner({ message: result.error, variant: "error" });
        return;
      }
      setLocalItems((current) =>
        current.map((entry) =>
          entry.id === result.item.id && !entry.isCustom
            ? { ...result.item, isCustom: false }
            : entry
        )
      );
    });
  }

  function handleRemove(item: PackingItem, itemIndex: number) {
    if (!canEdit) {
      return;
    }

    if (item.isCustom && !item.id) {
      return;
    }

    const previous = localItems;
    const removeIndex =
      item.id != null
        ? localItems.findIndex((entry) => entry.id === item.id)
        : itemIndex;
    const resolvedIndex = removeIndex >= 0 ? removeIndex : itemIndex;
    const generatedIndex = previous
      .slice(0, resolvedIndex)
      .filter((entry) => !entry.isCustom).length;
    const removeState = { undone: false };

    setLocalItems((current) =>
      current.filter((entry, index) => {
        if (item.id) {
          return entry.id !== item.id;
        }
        return index !== resolvedIndex;
      })
    );
    if (item.isCustom && editingId === item.id) {
      setEditingId(null);
    }

    showBanner({
      message: "Item removed",
      variant: "info",
      duration: UNDO_BANNER_MS,
      action: {
        label: "Undo",
        onClick: () => {
          removeState.undone = true;
          handleUndoRemove(item, resolvedIndex, generatedIndex);
        },
      },
    });

    startMutate(async () => {
      const result = item.isCustom
        ? await deleteCustomPackingItem({
            tripId,
            itemId: item.id!,
          })
        : await deletePackingItem({
            tripId,
            ...(item.id
              ? { itemId: item.id }
              : { itemIndex: generatedIndex }),
          });

      if (removeState.undone) {
        // Undo won the race — ensure the item still exists server-side.
        if (result.ok) {
          if (item.isCustom) {
            await restoreCustomPackingItem({
              tripId,
              item: {
                id: item.id,
                name: item.name,
                category: item.category,
                notes: item.notes,
                packed: item.packed,
              },
            });
          } else {
            await restorePackingItem({
              tripId,
              item: { ...item, isCustom: false },
              index: generatedIndex,
            });
          }
        }
        return;
      }

      if (!result.ok) {
        setLocalItems(previous);
        showBanner({ message: result.error, variant: "error" });
      }
    });
  }

  async function handleRemoveItems(itemsToRemove: PackingItem[]) {
    if (!canEdit || itemsToRemove.length === 0) {
      return;
    }

    const ids = itemsToRemove
      .map((item) => item.id)
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) {
      return;
    }

    const idSet = new Set(ids);
    const previous = localItems;
    const snapshot = itemsToRemove.map((item) => ({ ...item }));
    const undoState = { undone: false };

    setLocalItems((current) =>
      current.filter((entry) => !(entry.id && idSet.has(entry.id)))
    );
    if (editingId && idSet.has(editingId)) {
      setEditingId(null);
    }

    const result = await deletePackingItems({ tripId, itemIds: ids });
    if (!result.ok) {
      setLocalItems(previous);
      showBanner({ message: result.error, variant: "error" });
      throw new Error(result.error);
    }

    const count = result.deletedIds.length || ids.length;
    showBanner({
      message: count === 1 ? "Item removed" : `${count} items removed`,
      variant: "info",
      duration: UNDO_BANNER_MS,
      action: {
        label: "Undo",
        onClick: () => {
          undoState.undone = true;
          setLocalItems(previous);
          void (async () => {
            for (const item of snapshot) {
              if (item.isCustom) {
                await restoreCustomPackingItem({
                  tripId,
                  item: {
                    id: item.id,
                    name: item.name,
                    category: item.category,
                    notes: item.notes,
                    packed: item.packed,
                  },
                });
              } else {
                const generatedIndex = previous
                  .filter((entry) => !entry.isCustom)
                  .findIndex((entry) => entry.id === item.id);
                await restorePackingItem({
                  tripId,
                  item: { ...item, isCustom: false },
                  index: generatedIndex >= 0 ? generatedIndex : undefined,
                });
              }
            }
          })();
        },
      },
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
      onRemoveItem={canEdit ? handleRemove : undefined}
      onRemoveItems={canEdit ? handleRemoveItems : undefined}
      editingId={editingId}
      editForm={editForm}
      onEditFormChange={setEditForm}
      onEditSubmit={handleEditSubmit}
      onEditCancel={() => setEditingId(null)}
      onStartEdit={startEdit}
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
