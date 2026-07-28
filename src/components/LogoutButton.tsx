"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { usePillBanner } from "@/components/pill-banner-provider";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
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
      variant="ghost"
      size="sm"
      onClick={handleSignOut}
      disabled={isSigningOut}
      aria-label="Sign out"
    >
      {isSigningOut ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <LogOut className="size-4" aria-hidden />
      )}
      <span className="hidden sm:inline">Sign out</span>
    </Button>
  );
}
