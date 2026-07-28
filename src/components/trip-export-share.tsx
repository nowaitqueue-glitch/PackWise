"use client";

import { useState } from "react";
import { ChevronDown, Copy, Download, FileText, Share2 } from "lucide-react";
import { usePillBanner } from "@/components/pill-banner-provider";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  downloadPackingListPdf,
  formatPackingListText,
} from "@/lib/packing-export";
import type { PackingItem } from "@/lib/packing";

type TripExportShareProps = {
  destination: string;
  startDate: string;
  endDate: string;
  items: PackingItem[];
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function TripExportShare({
  destination,
  startDate,
  endDate,
  items,
}: TripExportShareProps) {
  const { showBanner } = usePillBanner();
  const [exportOpen, setExportOpen] = useState(false);
  const [busy, setBusy] = useState<"copy" | "pdf" | "share" | null>(null);

  const summary = () =>
    formatPackingListText({ destination, startDate, endDate, items });

  async function handleCopyAsText() {
    setBusy("copy");
    try {
      const ok = await copyText(summary());
      if (ok) {
        showBanner({ message: "Packing list copied.", variant: "success" });
      } else {
        showBanner({
          message: "Could not copy to clipboard.",
          variant: "error",
        });
      }
    } finally {
      setBusy(null);
      setExportOpen(false);
    }
  }

  async function handleSaveAsPdf() {
    setBusy("pdf");
    try {
      await downloadPackingListPdf({
        destination,
        startDate,
        endDate,
        items,
      });
      showBanner({ message: "PDF downloaded.", variant: "success" });
    } catch {
      showBanner({
        message: "Could not generate PDF.",
        variant: "error",
      });
    } finally {
      setBusy(null);
      setExportOpen(false);
    }
  }

  async function handleShare() {
    setBusy("share");
    const text = summary();
    try {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: `PackWise — ${destination}`,
            text,
          });
          showBanner({ message: "Shared successfully.", variant: "success" });
          return;
        } catch (error) {
          // User dismissed the share sheet — don't fall back to copy.
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          // Fall through to clipboard.
        }
      }

      const ok = await copyText(text);
      if (ok) {
        showBanner({
          message: "Share unavailable — packing list copied instead.",
          variant: "success",
        });
      } else {
        showBanner({
          message: "Could not share or copy packing list.",
          variant: "error",
        });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row">
      <Popover open={exportOpen} onOpenChange={setExportOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:flex-1"
            disabled={busy !== null}
            data-testid="trip-export"
          >
            <Download aria-hidden />
            Export
            <ChevronDown className="opacity-60" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(100vw-2rem,16rem)] p-1"
        >
          <div className="flex flex-col" role="menu" aria-label="Export options">
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              disabled={busy !== null}
              onClick={() => void handleCopyAsText()}
              data-testid="trip-export-copy-text"
            >
              <Copy className="size-4 shrink-0" aria-hidden />
              {busy === "copy" ? "Copying…" : "Copy as Text"}
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              disabled={busy !== null}
              onClick={() => void handleSaveAsPdf()}
              data-testid="trip-export-pdf"
            >
              <FileText className="size-4 shrink-0" aria-hidden />
              {busy === "pdf" ? "Saving…" : "Save as PDF"}
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="outline"
        className="w-full sm:flex-1"
        disabled={busy !== null}
        onClick={() => void handleShare()}
        data-testid="trip-share"
      >
        <Share2 aria-hidden />
        {busy === "share" ? "Sharing…" : "Share"}
      </Button>
    </div>
  );
}
