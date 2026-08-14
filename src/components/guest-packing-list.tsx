"use client";

import { useEffect, useState } from "react";
import {
  emptyCustomForm,
  PackingListView,
  type CustomFormState,
} from "@/components/packing-list-view";
import { usePillBanner } from "@/components/pill-banner-provider";
import type { PackingItem } from "@/lib/packing";
import {
  readGuestCustomItems,
  setGuestItemPacked,
  syncGuestCheckoffCount,
  writeGuestCustomItems,
  writeGuestPackingItems,
} from "@/lib/guest-storage";
import { Badge } from "@/components/ui/badge";

const UNDO_BANNER_MS = 5000;

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

export function GuestPackingList({
  initialItems,
  onPackedChange,
}: GuestPackingListProps) {
  const { showBanner } = usePillBanner();
  const [generated, setGenerated] = useState<PackingItem[]>(() =>
    initialItems
      .filter((item) => !item.isCustom)
      .map((item) => ({
        ...item,
        id:
          typeof item.id === "string" && item.id.trim()
            ? item.id.trim()
            : crypto.randomUUID(),
        isCustom: false as const,
      }))
  );
  const [custom, setCustom] = useState<PackingItem[]>(() =>
    readGuestCustomItems()
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<CustomFormState>(emptyCustomForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CustomFormState>(emptyCustomForm);

  const items = mergeDisplayItems(generated, custom);

  useEffect(() => {
    setGenerated(
      initialItems
        .filter((item) => !item.isCustom)
        .map((item) => ({
          ...item,
          id:
            typeof item.id === "string" && item.id.trim()
              ? item.id.trim()
              : crypto.randomUUID(),
          isCustom: false as const,
        }))
    );
  }, [initialItems]);

  function emitStats(next: PackingItem[]) {
    const checkoffCount = syncGuestCheckoffCount(next);
    const stats = statsFromItems(next);
    onPackedChange?.({ ...stats, checkoffCount });
  }

  function persistCustom(nextCustom: PackingItem[]) {
    setCustom(nextCustom);
    writeGuestCustomItems(nextCustom);
    emitStats(mergeDisplayItems(generated, nextCustom));
  }

  function persistGenerated(nextGenerated: PackingItem[]) {
    setGenerated(nextGenerated);
    writeGuestPackingItems(nextGenerated);
    emitStats(mergeDisplayItems(nextGenerated, custom));
  }

  function handleToggle(item: PackingItem, index: number, packed: boolean) {
    if (item.id) {
      const found = items.some((row) => row.id === item.id);
      if (!found) {
        console.warn("Item not found:", item.id);
        return;
      }
    }

    if (item.isCustom) {
      const nextCustom = custom.map((row, i) => {
        if (item.id) {
          return row.id === item.id ? { ...row, packed } : row;
        }
        const customIndex = index - generated.length;
        return i === customIndex ? { ...row, packed } : row;
      });
      setGuestItemPacked(item.name, packed);
      persistCustom(nextCustom);
      return;
    }

    setGenerated((prev) => {
      const nextGenerated = prev.map((row, i) => {
        if (item.id) {
          return row.id === item.id ? { ...row, packed } : row;
        }
        return i === index ? { ...row, packed } : row;
      });
      setGuestItemPacked(item.name, packed);
      writeGuestPackingItems(nextGenerated);
      emitStats(mergeDisplayItems(nextGenerated, custom));
      return nextGenerated;
    });
  }

  function handleAddSubmit(event: React.FormEvent) {
    event.preventDefault();
    const name = addForm.name.trim();
    if (!name) return;

    const nextItem: PackingItem = {
      id: crypto.randomUUID(),
      name,
      category: addForm.category.trim() || "Other",
      notes: addForm.notes.trim(),
      packed: false,
      isCustom: true,
    };
    persistCustom([...custom, nextItem]);
    setAddForm(emptyCustomForm());
    setShowAddForm(false);
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
    if (!editingId) return;
    const name = editForm.name.trim();
    if (!name) return;

    const nextCustom = custom.map((entry) =>
      entry.id === editingId
        ? {
            ...entry,
            name,
            category: editForm.category.trim() || "Other",
            notes: editForm.notes.trim(),
          }
        : entry
    );
    persistCustom(nextCustom);
    setEditingId(null);
  }

  function handleUndoRemove(
    item: PackingItem,
    generatedIndex: number,
    customIndex: number
  ) {
    if (item.isCustom) {
      setCustom((prev) => {
        if (item.id && prev.some((entry) => entry.id === item.id)) {
          return prev;
        }
        const next = insertAtIndex(
          prev,
          { ...item, isCustom: true },
          customIndex
        );
        writeGuestCustomItems(next);
        setGenerated((prevGenerated) => {
          emitStats(mergeDisplayItems(prevGenerated, next));
          return prevGenerated;
        });
        return next;
      });
      return;
    }

    setGenerated((prev) => {
      if (item.id && prev.some((entry) => entry.id === item.id)) {
        return prev;
      }
      const next = insertAtIndex(
        prev,
        { ...item, isCustom: false },
        generatedIndex
      );
      writeGuestPackingItems(next);
      setCustom((prevCustom) => {
        emitStats(mergeDisplayItems(next, prevCustom));
        return prevCustom;
      });
      return next;
    });
  }

  function handleRemove(item: PackingItem, index: number) {
    const displayIndex =
      item.id != null
        ? items.findIndex((entry) => entry.id === item.id)
        : index;
    const resolvedIndex = displayIndex >= 0 ? displayIndex : index;
    const generatedIndex = items
      .slice(0, resolvedIndex)
      .filter((entry) => !entry.isCustom).length;
    const customIndex = items
      .slice(0, resolvedIndex)
      .filter((entry) => entry.isCustom).length;

    if (item.isCustom) {
      if (!item.id) return;
      if (editingId === item.id) {
        setEditingId(null);
      }
      const nextCustom = custom.filter((entry) => entry.id !== item.id);
      persistCustom(nextCustom);
    } else {
      const nextGenerated = generated.filter((entry, i) => {
        if (item.id) {
          return entry.id !== item.id;
        }
        return i !== generatedIndex;
      });
      persistGenerated(nextGenerated);
    }

    showBanner({
      message: "Item removed",
      variant: "info",
      duration: UNDO_BANNER_MS,
      action: {
        label: "Undo",
        onClick: () =>
          handleUndoRemove(item, generatedIndex, customIndex),
      },
    });
  }

  async function handleRemoveItems(itemsToRemove: PackingItem[]) {
    if (itemsToRemove.length === 0) return;

    const ids = new Set(
      itemsToRemove
        .map((item) => item.id)
        .filter((id): id is string => Boolean(id))
    );
    if (ids.size === 0) return;

    const previousGenerated = generated;
    const previousCustom = custom;

    const nextGenerated = generated.filter(
      (entry) => !(entry.id && ids.has(entry.id))
    );
    const nextCustom = custom.filter(
      (entry) => !(entry.id && ids.has(entry.id))
    );

    if (editingId && ids.has(editingId)) {
      setEditingId(null);
    }

    setGenerated(nextGenerated);
    writeGuestPackingItems(nextGenerated);
    setCustom(nextCustom);
    writeGuestCustomItems(nextCustom);
    emitStats(mergeDisplayItems(nextGenerated, nextCustom));

    const count = itemsToRemove.length;
    showBanner({
      message: count === 1 ? "Item removed" : `${count} items removed`,
      variant: "info",
      duration: UNDO_BANNER_MS,
      action: {
        label: "Undo",
        onClick: () => {
          setGenerated(previousGenerated);
          writeGuestPackingItems(previousGenerated);
          setCustom(previousCustom);
          writeGuestCustomItems(previousCustom);
          emitStats(mergeDisplayItems(previousGenerated, previousCustom));
        },
      },
    });
  }

  return (
    <PackingListView
      items={items}
      celebrationKey="guest"
      readOnly={false}
      titleBadge={<Badge variant="secondary">Guest</Badge>}
      description="Checkoffs and custom items stay in this browser until you create an account."
      emptyMessage="No packing items yet."
      onTogglePacked={handleToggle}
      canManageCustom
      onRemoveItem={handleRemove}
      onRemoveItems={handleRemoveItems}
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
      testId="guest-packing-list"
    />
  );
}
