"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <span className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center">
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer grid h-5 w-5 place-content-center rounded-md border-2 border-brand-from/50 bg-white/70 shadow-sm backdrop-blur-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-transparent data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-brand-from data-[state=checked]:to-brand-to data-[state=checked]:text-white dark:border-brand-from/50 dark:bg-slate-900/60",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn("grid place-content-center text-current")}
      >
        <Check className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  </span>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
