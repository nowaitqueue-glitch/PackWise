"use client";

import { useTransition } from "react";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { usePillBanner } from "@/components/pill-banner-provider";
import { Button } from "@/components/ui/button";
import { DeleteAccountButton } from "./delete-account-button";
import { downloadMyData } from "./settings-actions";

export function SettingsPrivacy() {
  const { showBanner } = usePillBanner();
  const [isDownloading, startDownload] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">Download my data</p>
        <p className="text-sm text-muted-foreground">
          Export your trips and packing lists as a JSON file.
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-fit"
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
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Download JSON
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Privacy Policy
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Terms of Service
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>

      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-sm font-medium text-destructive">Delete account</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently remove your account, trips, packing lists, and related
          data. This cannot be undone.
        </p>
        <div className="mt-3">
          <DeleteAccountButton />
        </div>
      </div>
    </div>
  );
}
