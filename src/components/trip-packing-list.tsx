"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { regeneratePackingList, updatePackingItemPacked } from "@/app/dashboard/packing-actions";
import {
  createCustomPackingItem,
  deleteCustomPackingItem,
  updateCustomPackingItem,
  updateCustomPackingItemPacked,
} from "@/app/dashboard/packing-custom-actions";
import { usePillBanner } from "@/components/pill-banner-provider";
import {
  groupPackingItemsByCategory,
  packingProgress,
  type PackingItem,
  type PackingListSource,
} from "@/lib/packing";
import { PACKING_CATEGORIES } from "@/lib/packing-items-database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type TripPackingListProps = {
  tripId: string;
  items: PackingItem[];
  /** Custom items from packing_custom_items (merged into the checklist). */
  customItems?: PackingItem[];
  /** Owner-only; members can view but not regenerate. */
  canRegenerate?: boolean;
  /** Owner-only; members see read-only checkboxes. */
  canEdit?: boolean;
  /** How the stored list was generated. */
  listSource?: PackingListSource;
};

type CustomFormState = {
  name: string;
  category: string;
  notes: string;
};

const emptyForm = (): CustomFormState => ({
  name: "",
  category: PACKING_CATEGORIES[0],
  notes: "",
});

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
  const [addForm, setAddForm] = useState<CustomFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CustomFormState>(emptyForm);

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

    const previous = localItems;
    setLocalItems((current) =>
      current.map((entry, index) =>
        index === itemIndex ? { ...entry, packed } : entry
      )
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
            itemId: item.id,
            itemIndex: localItems
              .slice(0, itemIndex)
              .filter((entry) => !entry.isCustom).length,
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
      setAddForm(emptyForm());
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

  const groups = groupPackingItemsByCategory(localItems);
  const hasItems = groups.length > 0;
  const progress = packingProgress(localItems);
  const busy = isRegenerating || isMutating;

  const indexByRef = new Map<PackingItem, number>();
  localItems.forEach((item, index) => {
    indexByRef.set(item, index);
  });

  return (
    <Card
      className="relative w-full overflow-hidden rounded-2xl"
      data-testid="packing-list"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl bg-[url('/images/pattern.png')] bg-repeat opacity-5"
      />
      <div className="relative z-10">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">Packing list</CardTitle>
              {hasItems ? (
                <Badge variant="secondary" data-testid="packing-standard-badge">
                  Template
                </Badge>
              ) : null}
            </div>
            <CardDescription className="space-y-1.5">
              {hasItems ? (
                canEdit ? (
                  "Weather-aware checklist for this trip type"
                ) : (
                  <>
                    <span>
                      Shared view-only list — your travel buddies can see what
                      you’re bringing and pack alongside you.
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <span>Live collaborative check-offs</span>
                      <Badge variant="secondary">Coming soon</Badge>
                    </span>
                  </>
                )
              ) : (
                "No packing list yet — generate one to get started"
              )}
            </CardDescription>
          </div>
          {canRegenerate ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={busy}
              data-testid="packing-regenerate"
            >
              {isRegenerating ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <RefreshCw aria-hidden />
              )}
              {isRegenerating ? "Generating…" : "Regenerate"}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {hasItems ? (
            <div className="flex flex-col gap-2" data-testid="packing-progress">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span
                  className="font-medium tabular-nums"
                  data-testid="packing-progress-text"
                >
                  {progress.packed}/{progress.total} packed ({progress.percent}%)
                </span>
              </div>
              <Progress
                value={progress.percent}
                data-testid="packing-progress-bar"
              />
            </div>
          ) : null}

          {!hasItems ? (
            <p className="text-sm text-muted-foreground">
              {canRegenerate
                ? "Packing list generation may have failed. Use Regenerate to try again."
                : "No packing list yet. Ask the trip owner to generate one."}
            </p>
          ) : null}

          {groups.map((group) => (
            <section key={group.category} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold tracking-wide text-foreground">
                {group.category}
              </h3>
              <ul className="flex flex-col gap-2">
                {group.items.map((item, groupIndex) => {
                  const itemIndex = indexByRef.get(item) ?? groupIndex;
                  const key =
                    item.id ?? `${group.category}-${item.name}-${itemIndex}`;
                  const isEditing = item.isCustom && editingId === item.id;

                  return (
                    <li
                      key={key}
                      className="flex flex-col gap-2 border-b border-border pb-2 last:border-0 last:pb-0"
                      data-testid={
                        item.isCustom ? "packing-custom-item" : "packing-item"
                      }
                    >
                      {isEditing ? (
                        <CustomItemForm
                          form={editForm}
                          onChange={setEditForm}
                          onSubmit={handleEditSubmit}
                          onCancel={() => setEditingId(null)}
                          disabled={busy}
                          submitLabel="Save"
                          testIdPrefix="packing-custom-edit"
                        />
                      ) : (
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id={`pack-${key}`}
                            checked={item.packed}
                            disabled={!canEdit || isRegenerating}
                            onCheckedChange={(checked) => {
                              handleToggle(item, itemIndex, checked === true);
                            }}
                            className={cn(
                              "mt-0.5 h-5 w-5 rounded-md border-border/60 bg-background",
                              "shadow-[2px_2px_4px_rgba(0,0,0,0.06),-2px_-2px_4px_rgba(255,255,255,0.75)]",
                              "dark:shadow-[2px_2px_4px_rgba(0,0,0,0.35),-2px_-2px_4px_rgba(255,255,255,0.04)]",
                              "data-[state=checked]:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.12),inset_-1px_-1px_3px_rgba(255,255,255,0.65)]",
                              "dark:data-[state=checked]:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.45),inset_-1px_-1px_3px_rgba(255,255,255,0.06)]"
                            )}
                            aria-label={
                              canEdit
                                ? `Mark ${item.name} as packed`
                                : `${item.name} (${item.packed ? "packed" : "not packed"}; view only)`
                            }
                            data-testid="packing-item-checkbox"
                          />
                          <label
                            htmlFor={canEdit ? `pack-${key}` : undefined}
                            className={cn(
                              "min-w-0 flex-1",
                              canEdit ? "cursor-pointer" : "cursor-default"
                            )}
                          >
                            <p
                              className={cn(
                                "text-sm font-medium",
                                item.packed &&
                                  "text-muted-foreground line-through"
                              )}
                            >
                              {item.name}
                            </p>
                            {item.notes ? (
                              <p className="text-xs text-muted-foreground">
                                {item.notes}
                              </p>
                            ) : null}
                          </label>
                          {canEdit && item.isCustom ? (
                            <div className="flex shrink-0 items-center gap-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground"
                                onClick={() => startEdit(item)}
                                disabled={busy}
                                aria-label={`Edit ${item.name}`}
                                data-testid="packing-custom-edit"
                              >
                                <Pencil className="size-3.5" aria-hidden />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(item)}
                                disabled={busy}
                                aria-label={`Delete ${item.name}`}
                                data-testid="packing-custom-delete"
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {canEdit ? (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              {showAddForm ? (
                <CustomItemForm
                  form={addForm}
                  onChange={setAddForm}
                  onSubmit={handleAddSubmit}
                  onCancel={() => {
                    setShowAddForm(false);
                    setAddForm(emptyForm());
                  }}
                  disabled={busy}
                  submitLabel="Add item"
                  testIdPrefix="packing-custom-add"
                />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setEditingId(null);
                    setShowAddForm(true);
                  }}
                  disabled={busy}
                  data-testid="packing-add-custom"
                >
                  <Plus aria-hidden />
                  Add custom item
                </Button>
              )}
            </div>
          ) : null}
        </CardContent>
      </div>
    </Card>
  );
}

function CustomItemForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  disabled,
  submitLabel,
  testIdPrefix,
}: {
  form: CustomFormState;
  onChange: (next: CustomFormState) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  disabled: boolean;
  submitLabel: string;
  testIdPrefix: string;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border/70 bg-background/60 p-3"
      data-testid={testIdPrefix}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${testIdPrefix}-name`}>Item name</Label>
        <Input
          id={`${testIdPrefix}-name`}
          value={form.name}
          onChange={(event) =>
            onChange({ ...form, name: event.target.value })
          }
          placeholder="e.g. Travel pillow"
          required
          maxLength={120}
          disabled={disabled}
          data-testid={`${testIdPrefix}-name`}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${testIdPrefix}-category`}>Category</Label>
        <Select
          value={form.category}
          onValueChange={(category) => onChange({ ...form, category })}
          disabled={disabled}
        >
          <SelectTrigger
            id={`${testIdPrefix}-category`}
            data-testid={`${testIdPrefix}-category`}
          >
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {PACKING_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${testIdPrefix}-notes`}>Notes (optional)</Label>
        <Input
          id={`${testIdPrefix}-notes`}
          value={form.notes}
          onChange={(event) =>
            onChange({ ...form, notes: event.target.value })
          }
          placeholder="Quantity, brand, reminder…"
          maxLength={240}
          disabled={disabled}
          data-testid={`${testIdPrefix}-notes`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={disabled || !form.name.trim()}
          data-testid={`${testIdPrefix}-submit`}
        >
          {disabled ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : null}
          {submitLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={disabled}
          data-testid={`${testIdPrefix}-cancel`}
        >
          <X aria-hidden />
          Cancel
        </Button>
      </div>
    </form>
  );
}
