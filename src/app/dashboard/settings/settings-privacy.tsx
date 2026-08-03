"use client";

import { useTransition } from "react";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { usePillBanner } from "@/components/pill-banner-provider";
import { Button } from "@/components/ui/button";
import { cn, glassChip } from "@/lib/utils";
import { downloadMyData } from "./settings-actions";

export function SettingsPrivacy() {
  const { showBanner } = usePillBanner();
  const [isDownloading, startDownload] = useTransition();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Download my data
          </p>
          <p className="text-sm text-muted-foreground">
            Export your trips and packing lists as a JSON file.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="w-full shrink-0 sm:w-auto"
          disabled={isDownloading}
          onClick={() => {
            startDownload(async () => {
              const result = await downloadMyData();
              if (!result.ok) {
                showBanner({ message: result.error, variant: "error" });
                return;
              }

              const blob = new Blob([JSON.stringify(result.data, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              const stamp = new Date().toISOString().slice(0, 10);
              anchor.href = url;
              anchor.download = `packwise-data-${stamp}.json`;
              document.body.appendChild(anchor);
              anchor.click();
              anchor.remove();
              URL.revokeObjectURL(url);
              showBanner({ message: "Download started.", variant: "success" });
            });
          }}
        >
          {isDownloading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          Download JSON
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-900/5 pt-5 dark:border-white/10">
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            glassChip,
            "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-all hover:text-foreground hover:shadow-sm"
          )}
        >
          Privacy Policy
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            glassChip,
            "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-all hover:text-foreground hover:shadow-sm"
          )}
        >
          Terms of Service
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>
    </div>
  );
}
