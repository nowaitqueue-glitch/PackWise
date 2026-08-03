"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { usePillBanner } from "@/components/pill-banner-provider";
import { Button, type ButtonProps } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type LogoutButtonProps = {
  className?: string;
  /** Header usage collapses to icon-only on small screens; settings keeps the label. */
  compact?: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
};

export function LogoutButton({
  className,
  compact = true,
  variant = "ghost",
  size = "sm",
}: LogoutButtonProps = {}) {
  const router = useRouter();
  const { showBanner } = usePillBanner();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        showBanner({
          message: error.message || "Could not sign out. Try again.",
          variant: "error",
        });
        setIsSigningOut(false);
        return;
      }
      router.push("/login");
    } catch {
      showBanner({
        message: "Could not sign out. Try again.",
        variant: "error",
      });
      setIsSigningOut(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(
        compact && "min-h-11 min-w-11 p-2 sm:min-w-0 sm:px-3",
        className
      )}
      onClick={handleSignOut}
      disabled={isSigningOut}
      aria-label="Sign out"
    >
      {isSigningOut ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <LogOut className="size-4" aria-hidden />
      )}
      <span className={cn(compact && "hidden sm:inline")}>Sign out</span>
    </Button>
  );
}
