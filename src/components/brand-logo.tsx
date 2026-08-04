import Image from "next/image";
import Link from "next/link";
import { cn, travelGradientText } from "@/lib/utils";

type BrandLogoProps = {
  href?: string | null;
  className?: string;
  /** `light` = white wordmark for dark/gradient surfaces; default `dark` for solid pages. */
  variant?: "light" | "dark";
};

export function BrandLogo({
  href = "/",
  className,
  variant = "dark",
}: BrandLogoProps) {
  const isLight = variant === "light";

  const content = (
    <>
      <Image
        src="/images/brand-logo.png"
        alt={href ? "PackWise home" : "PackWise"}
        width={40}
        height={40}
        className={cn(
          "h-10 w-10 object-contain",
          isLight && "drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
        )}
        priority
      />
      <span
        className={cn(
          "text-base font-bold tracking-tight sm:text-lg",
          isLight
            ? "text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
            : travelGradientText
        )}
      >
        PackWise
      </span>
    </>
  );

  const base = "inline-flex items-center gap-2 rounded-xl";

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          base,
          "no-underline transition-opacity hover:opacity-80",
          className
        )}
      >
        {content}
      </Link>
    );
  }

  return <div className={cn(base, className)}>{content}</div>;
}
