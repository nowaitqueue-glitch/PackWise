"use client";

import React from "react";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, glassCard } from "@/lib/utils";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleRefresh = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
          <div className={cn("max-w-md p-8 sm:p-10", glassCard)}>
            <div
              aria-hidden
              className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-from to-brand-to text-white shadow-md"
            >
              <Compass className="size-7" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              We lost the map for a second
            </h1>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              Something went wrong on this page. Refreshing usually gets you
              back on track.
            </p>
            <Button
              type="button"
              className="mt-6 w-full"
              aria-label="Refresh page"
              onClick={this.handleRefresh}
            >
              Refresh page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
