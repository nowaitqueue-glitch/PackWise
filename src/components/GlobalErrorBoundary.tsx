"use client";

import React from "react";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/error-reporting";
import { cn, glassCard } from "@/lib/utils";

type GlobalErrorBoundaryProps = {
  children: React.ReactNode;
};

type GlobalErrorBoundaryState = {
  hasError: boolean;
};

/**
 * Root React error boundary — catches render failures and shows a
 * friendly refresh fallback. Uses reportError (edge-safe console today;
 * Sentry-ready later). Prefer this over nesting a second ErrorBoundary.
 */
export class GlobalErrorBoundary extends React.Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  constructor(props: GlobalErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): GlobalErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    reportError(error, {
      boundary: "GlobalErrorBoundary",
      componentStack: errorInfo.componentStack,
    });
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
              Something went wrong
            </h1>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              Something went wrong — please refresh
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
