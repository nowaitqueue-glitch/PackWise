import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-brand-from bg-travel-gradient text-white shadow-md hover:shadow-lg hover:brightness-[1.06] dark:text-white",
        destructive:
          "bg-destructive text-destructive-foreground shadow-md hover:shadow-lg hover:bg-destructive/90",
        /** Subtle icon-only delete affordance (pairs with deleteButtonIconClass). */
        destructiveGhost:
          "text-muted-foreground hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400",
        outline:
          "border border-gray-200 bg-white/50 text-foreground shadow-sm backdrop-blur-sm hover:bg-white/80 hover:shadow dark:border-white/20 dark:bg-white/10 dark:hover:bg-white/15",
        secondary:
          "border border-gray-200 bg-white/70 text-foreground shadow-sm backdrop-blur-sm hover:bg-white/90 hover:shadow dark:border-white/20 dark:bg-slate-800/80 dark:hover:bg-slate-800",
        ghost:
          "text-foreground hover:bg-white/60 hover:shadow-sm dark:hover:bg-white/10",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "min-h-11 rounded-lg px-4 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "min-h-11 min-w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
