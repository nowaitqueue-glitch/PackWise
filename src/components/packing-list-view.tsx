"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { usePillBanner } from "@/components/pill-banner-provider";
import { ShopEssentialsCard } from "@/components/shop-essentials-card";
import {
  groupPackingItemsByCategory,
  packingProgress,
  type PackingItem,
} from "@/lib/packing";
import { PACKING_CATEGORIES } from "@/lib/packing-items-database";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  cn,
  glassCard,
  glassCardHover,
  glassChip,
  sectionTitleClass,
  solidContentCard,
} from "@/lib/utils";

export type CustomFormState = {
  name: string;
  category: string;
  notes: string;
};

export function emptyCustomForm(): CustomFormState {
  return {
    name: "",
    category: PACKING_CATEGORIES[0],
    notes: "",
  };
}

const CELEBRATION_BANNER =
  "You’re all packed! Have an amazing trip.";
const CELEBRATION_STORAGE_PREFIX = "packwise-celebrated:";
const CELEBRATION_GRADIENT_MS = 2200;
const CELEBRATION_BANNER_MS = 4500;
const INSTALL_PROMPT_SESSION_KEY = "packwise-install-prompt";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let installListenerBound = false;

function bindInstallPromptListener(): void {
  if (typeof window === "undefined" || installListenerBound) return;
  installListenerBound = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
  });
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return true;
    }
  } catch {
    // ignore
  }
  try {
    if (
      document.documentElement.getAttribute("data-reduced-motion") === "true"
    ) {
      return true;
    }
  } catch {
    // ignore
  }
  try {
    if (localStorage.getItem("packwise-reduced-motion") === "1") {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

function hasSeenInstallPrompt(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return sessionStorage.getItem(INSTALL_PROMPT_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markInstallPromptSeen(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(INSTALL_PROMPT_SESSION_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}

function hasCelebrated(key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return sessionStorage.getItem(`${CELEBRATION_STORAGE_PREFIX}${key}`) === "1";
  } catch {
    return false;
  }
}

function markCelebrated(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${CELEBRATION_STORAGE_PREFIX}${key}`, "1");
  } catch {
    // ignore quota / private mode
  }
}

const loadConfetti = () =>
  import("canvas-confetti").then((m) => m.default);

function firePackingConfetti(): void {
  void loadConfetti().then((confetti) => {
    confetti({
      particleCount: 64,
      spread: 58,
      startVelocity: 28,
      gravity: 0.9,
      scalar: 0.85,
      ticks: 120,
      origin: { x: 0.5, y: 0.35 },
      colors: ["#3b82f6", "#2dd4bf", "#60a5fa", "#5eead4", "#ffffff"],
    });
  });
}

/** Shared solid panel used by the header, each category, and the add form. */
function PackingPanel({
  className,
  pattern = false,
  children,
}: {
  className?: string;
  pattern?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("relative overflow-hidden", solidContentCard, className)}
    >
      {pattern ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[url('/images/pattern.png')] bg-repeat opacity-5"
        />
      ) : null}
      <div className="relative z-10 flex flex-col gap-4 p-5 sm:p-6">
        {children}
      </div>
    </section>
  );
}

function packingItemKey(item: PackingItem, itemIndex: number): string {
  return item.id ?? `${item.category}-${item.name}-${itemIndex}`;
}

export type PackingListViewProps = {
  items: PackingItem[];
  /** Stable key for per-session 100% celebration (trip id or "guest"). */
  celebrationKey: string;
  /** When true, checkboxes are view-only. */
  readOnly?: boolean;
  /** Extra disable (e.g. while regenerating). */
  disabled?: boolean;
  busy?: boolean;
  titleBadge?: React.ReactNode;
  description?: React.ReactNode;
  headerActions?: React.ReactNode;
  emptyMessage?: React.ReactNode;
  onTogglePacked: (item: PackingItem, index: number, packed: boolean) => void;
  /** Owner edit/add for custom items; also enables remove on every row. */
  canManageCustom?: boolean;
  /** Remove any item (template or custom). Called after fade-out. */
  onRemoveItem?: (item: PackingItem, index: number) => void;
  /** Batch remove selected items. Called after staggered fade-out. */
  onRemoveItems?: (items: PackingItem[]) => void | Promise<void>;
  editingId?: string | null;
  editForm?: CustomFormState;
  onEditFormChange?: (form: CustomFormState) => void;
  onEditSubmit?: (event: React.FormEvent) => void;
  onEditCancel?: () => void;
  onStartEdit?: (item: PackingItem) => void;
  showAddForm?: boolean;
  addForm?: CustomFormState;
  onAddFormChange?: (form: CustomFormState) => void;
  onAddSubmit?: (event: React.FormEvent) => void;
  onAddCancel?: () => void;
  onShowAddForm?: () => void;
  testId?: string;
};

const REMOVE_FADE_MS = 250;
const BATCH_STAGGER_MS = 50;

export function PackingListView({
  items,
  celebrationKey,
  readOnly = false,
  disabled = false,
  busy = false,
  titleBadge,
  description,
  headerActions,
  emptyMessage,
  onTogglePacked,
  canManageCustom = false,
  onRemoveItem,
  onRemoveItems,
  editingId = null,
  editForm,
  onEditFormChange,
  onEditSubmit,
  onEditCancel,
  onStartEdit,
  showAddForm = false,
  addForm,
  onAddFormChange,
  onAddSubmit,
  onAddCancel,
  onShowAddForm,
  testId = "packing-list",
}: PackingListViewProps) {
  const { showBanner } = usePillBanner();
  const [celebrateGradient, setCelebrateGradient] = useState(false);
  const [showInstallHint, setShowInstallHint] = useState(false);
  const [exitingKeys, setExitingKeys] = useState<Set<string>>(() => new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [confirmBatchOpen, setConfirmBatchOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const celebratedRef = useRef(false);
  const gradientTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const installTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const batchTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const groups = groupPackingItemsByCategory(items);
  const hasItems = groups.length > 0;
  const progress = packingProgress(items);

  const indexByRef = new Map<PackingItem, number>();
  items.forEach((item, index) => {
    indexByRef.set(item, index);
  });

  const canRemove = Boolean(canManageCustom && onRemoveItem && !readOnly);
  const canBatchRemove = Boolean(
    canManageCustom && onRemoveItems && !readOnly
  );
  const showSelectToggle = canBatchRemove && hasItems;

  useEffect(() => {
    bindInstallPromptListener();
  }, []);

  useEffect(() => {
    celebratedRef.current = hasCelebrated(celebrationKey);
  }, [celebrationKey]);

  useEffect(() => {
    if (
      progress.total <= 0 ||
      progress.percent < 100 ||
      celebratedRef.current ||
      hasCelebrated(celebrationKey)
    ) {
      return;
    }

    celebratedRef.current = true;
    markCelebrated(celebrationKey);

    showBanner({
      message: CELEBRATION_BANNER,
      variant: "success",
      duration: CELEBRATION_BANNER_MS,
    });

    if (!prefersReducedMotion()) {
      firePackingConfetti();
    }

    setCelebrateGradient(true);
    if (gradientTimerRef.current) {
      clearTimeout(gradientTimerRef.current);
    }
    gradientTimerRef.current = setTimeout(() => {
      setCelebrateGradient(false);
      gradientTimerRef.current = null;
    }, CELEBRATION_GRADIENT_MS);

    // Guest-only PWA hint after the celebration banner has had the spotlight.
    if (
      celebrationKey === "guest" &&
      !isStandalonePwa() &&
      !hasSeenInstallPrompt()
    ) {
      if (installTimerRef.current) {
        clearTimeout(installTimerRef.current);
      }
      installTimerRef.current = setTimeout(() => {
        installTimerRef.current = null;
        if (isStandalonePwa() || hasSeenInstallPrompt()) return;
        markInstallPromptSeen();
        setShowInstallHint(true);
      }, CELEBRATION_BANNER_MS);
    }
  }, [celebrationKey, progress.percent, progress.total, showBanner]);

  useEffect(() => {
    const removeTimers = removeTimersRef.current;
    return () => {
      if (gradientTimerRef.current) {
        clearTimeout(gradientTimerRef.current);
      }
      if (installTimerRef.current) {
        clearTimeout(installTimerRef.current);
      }
      for (const timer of Array.from(removeTimers.values())) {
        clearTimeout(timer);
      }
      removeTimers.clear();
      for (const timer of batchTimersRef.current) {
        clearTimeout(timer);
      }
      batchTimersRef.current = [];
    };
  }, []);

  // Drop selection keys that no longer exist (e.g. after single-item remove).
  useEffect(() => {
    const validKeys = new Set(
      items.map((item, index) => packingItemKey(item, index))
    );
    setSelectedItems((current) => {
      const next = current.filter((key) => validKeys.has(key));
      return next.length === current.length ? current : next;
    });
    if (!hasItems && isSelectionMode) {
      setIsSelectionMode(false);
      setSelectedItems([]);
      setConfirmBatchOpen(false);
    }
  }, [items, hasItems, isSelectionMode]);

  async function handleInstallHintClick() {
    setShowInstallHint(false);
    markInstallPromptSeen();
    const promptEvent = deferredInstallPrompt;
    if (!promptEvent) return;
    deferredInstallPrompt = null;
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch {
      // User dismissed or browser blocked the prompt.
    }
  }

  function dismissInstallHint() {
    setShowInstallHint(false);
    markInstallPromptSeen();
  }

  function exitSelectionMode() {
    setIsSelectionMode(false);
    setSelectedItems([]);
    setConfirmBatchOpen(false);
  }

  function enterSelectionMode() {
    setEditingIdSafe();
    setIsSelectionMode(true);
    setSelectedItems([]);
  }

  function setEditingIdSafe() {
    onEditCancel?.();
    onAddCancel?.();
  }

  function toggleSelected(key: string) {
    setSelectedItems((current) =>
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key]
    );
  }

  function handleRemoveClick(item: PackingItem, itemIndex: number, key: string) {
    if (!onRemoveItem || readOnly || disabled || busy || isSelectionMode) {
      return;
    }
    if (exitingKeys.has(key) || removeTimersRef.current.has(key)) return;

    const fadeMs = prefersReducedMotion() ? 0 : REMOVE_FADE_MS;
    setExitingKeys((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });

    const timer = setTimeout(() => {
      removeTimersRef.current.delete(key);
      setExitingKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      onRemoveItem(item, itemIndex);
    }, fadeMs);
    removeTimersRef.current.set(key, timer);
  }

  async function confirmBatchDelete() {
    if (!onRemoveItems || isBatchDeleting || selectedItems.length === 0) {
      return;
    }

    const selectedKeySet = new Set(selectedItems);
    const toRemove: PackingItem[] = [];
    const removeKeys: string[] = [];

    items.forEach((item, index) => {
      const key = packingItemKey(item, index);
      if (selectedKeySet.has(key)) {
        // Batch delete requires stable ids for the server / storage helpers.
        if (!item.id) return;
        toRemove.push(item);
        removeKeys.push(key);
      }
    });

    if (toRemove.length === 0) {
      setConfirmBatchOpen(false);
      return;
    }

    setIsBatchDeleting(true);
    setConfirmBatchOpen(false);

    const reduced = prefersReducedMotion();
    const stagger = reduced ? 0 : BATCH_STAGGER_MS;
    const fadeMs = reduced ? 0 : REMOVE_FADE_MS;

    for (const timer of batchTimersRef.current) {
      clearTimeout(timer);
    }
    batchTimersRef.current = [];

    await new Promise<void>((resolve) => {
      removeKeys.forEach((key, i) => {
        const startTimer = setTimeout(() => {
          setExitingKeys((current) => {
            const next = new Set(current);
            next.add(key);
            return next;
          });
        }, i * stagger);
        batchTimersRef.current.push(startTimer);
      });

      const doneAt =
        (removeKeys.length > 0 ? (removeKeys.length - 1) * stagger : 0) +
        fadeMs;
      const doneTimer = setTimeout(() => resolve(), doneAt);
      batchTimersRef.current.push(doneTimer);
    });

    try {
      await onRemoveItems(toRemove);
      setExitingKeys((current) => {
        const next = new Set(current);
        for (const key of removeKeys) next.delete(key);
        return next;
      });
      exitSelectionMode();
    } catch {
      setExitingKeys((current) => {
        const next = new Set(current);
        for (const key of removeKeys) next.delete(key);
        return next;
      });
      showBanner({
        message: "Could not remove items. Please try again.",
        variant: "error",
      });
    } finally {
      setIsBatchDeleting(false);
      batchTimersRef.current = [];
    }
  }

  const checkboxesDisabled = readOnly || disabled;
  const selectedCount = selectedItems.length;
  const batchDeleteLabel =
    selectedCount === 1
      ? "Delete 1 item"
      : `Delete ${selectedCount} items`;
  const batchConfirmTitle =
    selectedCount === 1
      ? "Remove 1 item from this list?"
      : `Remove ${selectedCount} items from this list?`;

  return (
    <div className="flex w-full flex-col gap-4" data-testid={testId}>
      <PackingPanel className={glassCardHover} pattern>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={sectionTitleClass}>Packing list</h2>
              {titleBadge}
            </div>
            {description ? (
              <div className="space-y-1.5 text-sm text-muted-foreground">
                {description}
              </div>
            ) : null}
          </div>
          {headerActions}
        </div>

        {hasItems ? (
          <div className="flex flex-col gap-2" data-testid="packing-progress">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-sm font-semibold text-foreground">
                Packing progress
              </span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span
                  className="text-sm font-semibold tabular-nums text-foreground"
                  data-testid="packing-progress-text"
                >
                  {progress.packed}/{progress.total} packed ({progress.percent}
                  %)
                </span>
                {showSelectToggle ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-0.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      if (isSelectionMode) {
                        exitSelectionMode();
                      } else {
                        enterSelectionMode();
                      }
                    }}
                    disabled={disabled || busy || isBatchDeleting}
                    aria-pressed={isSelectionMode}
                    data-testid="packing-select-toggle"
                  >
                    {isSelectionMode ? "Done" : "Select"}
                  </Button>
                ) : null}
              </div>
            </div>
            <Progress
              value={progress.percent}
              className="h-2.5"
              indicatorClassName={
                celebrateGradient
                  ? "bg-travel-gradient"
                  : undefined
              }
              aria-label="Packing progress"
              data-testid="packing-progress-bar"
            />
          </div>
        ) : null}

        {showInstallHint ? (
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2",
              glassChip
            )}
            role="status"
            data-testid="pwa-install-hint"
          >
            <button
              type="button"
              className="min-w-0 flex-1 rounded-md text-left text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline"
              onClick={() => void handleInstallHintClick()}
            >
              Install PackWise for quick access →
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 rounded-full text-muted-foreground"
              aria-label="Dismiss install hint"
              onClick={dismissInstallHint}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        ) : null}

        {!hasItems && emptyMessage ? (
          <div className="text-sm text-muted-foreground">{emptyMessage}</div>
        ) : null}
      </PackingPanel>

      {groups.map((group) => {
        const packedInGroup = group.items.filter((item) => item.packed).length;

        return (
          <PackingPanel
            key={group.category}
            className="transition-shadow duration-300 hover:shadow-xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className={sectionTitleClass}>{group.category}</h3>
              <span
                className={cn(
                  "px-2.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground",
                  glassChip
                )}
              >
                {packedInGroup}/{group.items.length} packed
              </span>
            </div>
            <ul className="-mx-2 flex flex-col">
              {group.items.map((item, groupIndex) => {
                const itemIndex = indexByRef.get(item) ?? groupIndex;
                const key = packingItemKey(item, itemIndex);
                const isExiting = exitingKeys.has(key);
                const isSelected = selectedItems.includes(key);
                const selectable =
                  isSelectionMode && Boolean(item.id) && !isBatchDeleting;
                const isEditing =
                  !isSelectionMode &&
                  canManageCustom &&
                  item.isCustom &&
                  editingId === item.id &&
                  editForm &&
                  onEditFormChange &&
                  onEditSubmit &&
                  onEditCancel;

                return (
                  <li
                    key={key}
                    className={cn(
                      "group rounded-xl transition-[opacity,colors,box-shadow] duration-300 ease-out",
                      isExiting && "pointer-events-none opacity-0",
                      isSelectionMode &&
                        "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200",
                      isSelected &&
                        "bg-blue-500/10 ring-1 ring-inset ring-blue-500/25 dark:bg-blue-400/10 dark:ring-blue-400/30",
                      isEditing
                        ? "p-2"
                        : !isSelected && "hover:bg-white/50 dark:hover:bg-white/5"
                    )}
                    data-testid={
                      item.isCustom ? "packing-custom-item" : "packing-item"
                    }
                  >
                    {isEditing ? (
                      <CustomItemForm
                        form={editForm}
                        onChange={onEditFormChange}
                        onSubmit={onEditSubmit}
                        onCancel={onEditCancel}
                        disabled={busy}
                        submitLabel="Save"
                        testIdPrefix="packing-custom-edit"
                      />
                    ) : isSelectionMode ? (
                      <button
                        type="button"
                        className={cn(
                          "flex min-h-11 w-full items-center gap-3 px-2 py-1.5 text-left",
                          !selectable && "cursor-default opacity-60"
                        )}
                        disabled={!selectable || isExiting}
                        aria-pressed={isSelected}
                        aria-label={
                          isSelected
                            ? `Deselect ${item.name}`
                            : `Select ${item.name}`
                        }
                        data-testid="packing-item-select"
                        onClick={() => {
                          if (!selectable) return;
                          toggleSelected(key);
                        }}
                      >
                        <span
                          className={cn(
                            "grid size-5 shrink-0 place-content-center rounded-full border-2 transition-all",
                            "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200",
                            isSelected
                              ? "border-transparent bg-blue-500 text-white dark:bg-blue-400"
                              : "border-blue-500/45 bg-white/80 dark:border-blue-400/45 dark:bg-slate-900/70"
                          )}
                          aria-hidden
                        >
                          {isSelected ? (
                            <Check className="size-3" strokeWidth={3} />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1 py-1">
                          <span
                            className={cn(
                              "block text-sm font-medium transition-colors",
                              item.packed
                                ? "text-muted-foreground/70 line-through"
                                : "text-foreground"
                            )}
                          >
                            {item.name}
                          </span>
                          {item.notes ? (
                            <span
                              className={cn(
                                "block text-xs text-muted-foreground",
                                item.packed && "line-through opacity-70"
                              )}
                            >
                              {item.notes}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    ) : (
                      <div className="flex min-h-11 items-center gap-3 px-2 py-1.5">
                        <Checkbox
                          id={`pack-${celebrationKey}-${key}`}
                          checked={item.packed}
                          disabled={checkboxesDisabled || isExiting}
                          onCheckedChange={(checked) => {
                            onTogglePacked(item, itemIndex, checked === true);
                          }}
                          className="data-[state=checked]:motion-safe:animate-packing-check-bounce"
                          aria-label={
                            readOnly
                              ? `${item.name} (${item.packed ? "packed" : "not packed"}; view only)`
                              : `Mark ${item.name} as packed`
                          }
                          data-testid="packing-item-checkbox"
                        />
                        <label
                          htmlFor={
                            readOnly
                              ? undefined
                              : `pack-${celebrationKey}-${key}`
                          }
                          className={cn(
                            "min-w-0 flex-1 py-1",
                            readOnly ? "cursor-default" : "cursor-pointer"
                          )}
                        >
                          <span
                            className={cn(
                              "block text-sm font-medium transition-colors",
                              item.packed
                                ? "text-muted-foreground/70 line-through"
                                : "text-foreground"
                            )}
                          >
                            {item.name}
                          </span>
                          {item.notes ? (
                            <span
                              className={cn(
                                "block text-xs text-muted-foreground",
                                item.packed && "line-through opacity-70"
                              )}
                            >
                              {item.notes}
                            </span>
                          ) : null}
                        </label>
                        {/* Individual affiliate icons disabled — using single curated list instead */}
                        {/* {item.affiliateLink ? (
                          <a
                            href={item.affiliateLink}
                            target="_blank"
                            rel="noopener noreferrer sponsored"
                            className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                            aria-label={`Buy ${item.name} (opens in a new tab)`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <ShoppingBag className="size-3.5" aria-hidden />
                            Buy
                          </a>
                        ) : null} */}

                        {canManageCustom && item.isCustom ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="min-h-11 min-w-11 shrink-0 p-2 text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                            onClick={() => onStartEdit?.(item)}
                            disabled={busy || isExiting}
                            aria-label={`Edit ${item.name}`}
                            data-testid="packing-custom-edit"
                          >
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                        ) : null}

                        {canRemove ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="min-h-11 min-w-11 shrink-0 p-2 text-gray-400 opacity-100 transition-colors hover:text-red-500 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                            onClick={() =>
                              handleRemoveClick(item, itemIndex, key)
                            }
                            disabled={busy || isExiting}
                            aria-label={`Remove ${item.name}`}
                            data-testid="packing-item-remove"
                          >
                            <Trash2 className="size-4 sm:size-5" aria-hidden />
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </PackingPanel>
        );
      })}

      {canManageCustom && !isSelectionMode ? (
        <PackingPanel>
          {showAddForm && addForm && onAddFormChange && onAddSubmit && onAddCancel ? (
            <CustomItemForm
              form={addForm}
              onChange={onAddFormChange}
              onSubmit={onAddSubmit}
              onCancel={onAddCancel}
              disabled={busy}
              submitLabel="Add item"
              testIdPrefix="packing-custom-add"
            />
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto sm:self-start"
              onClick={onShowAddForm}
              disabled={busy}
              data-testid="packing-add-custom"
            >
              <Plus aria-hidden />
              Add custom item
            </Button>
          )}
        </PackingPanel>
      ) : null}

      <ShopEssentialsCard />

      {canBatchRemove && selectedCount > 0 ? (
        <>
          <div
            role="toolbar"
            aria-label="Batch packing item actions"
            className={cn(
              "fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-lg items-center gap-2 p-3 sm:bottom-6 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full",
              glassCard,
              "shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200"
            )}
            data-testid="packing-batch-bar"
          >
            <Button
              type="button"
              variant="destructive"
              className="min-w-0 flex-1"
              disabled={isBatchDeleting || busy}
              onClick={() => setConfirmBatchOpen(true)}
              data-testid="packing-batch-delete"
            >
              {isBatchDeleting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 aria-hidden />
              )}
              <span className="truncate">
                {isBatchDeleting ? "Deleting…" : batchDeleteLabel}
              </span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isBatchDeleting}
              onClick={() => setSelectedItems([])}
              data-testid="packing-batch-deselect"
            >
              Deselect all
            </Button>
          </div>

          <AlertDialog
            open={confirmBatchOpen && selectedCount > 0}
            onOpenChange={(next) => {
              if (isBatchDeleting) return;
              if (next && selectedCount === 0) return;
              setConfirmBatchOpen(next);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>{batchConfirmTitle}</AlertDialogTitle>
                  <AlertDialogDescription>
                    You can undo from the banner right after deleting.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isBatchDeleting}>
                  Cancel
                </AlertDialogCancel>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isBatchDeleting}
                  onClick={() => void confirmBatchDelete()}
                  data-testid="packing-batch-delete-confirm"
                >
                  {isBatchDeleting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Deleting…
                    </>
                  ) : (
                    batchDeleteLabel
                  )}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  );
}

export function CustomItemForm({
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
      className="flex flex-col gap-3"
      data-testid={testIdPrefix}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
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
        <div className="flex flex-col gap-1.5 sm:w-44">
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
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
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
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="submit"
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
            onClick={onCancel}
            disabled={disabled}
            data-testid={`${testIdPrefix}-cancel`}
          >
            <X aria-hidden />
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
