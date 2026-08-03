import Image from "next/image";
import Link from "next/link";
import { cn, travelGradientText } from "@/lib/utils";

type BrandLogoProps = {
  href?: string | null;
  className?: string;
};

export function BrandLogo({ href = "/", className }: BrandLogoProps) {
  const content = (
    <>
      <Image
        src="/images/logo.png"
        alt={href ? "PackWise home" : "PackWise"}
        width={40}
        height={40}
        className="h-10 w-auto"
        priority
      />
      <span
        className={cn(
          "text-base font-bold tracking-tight sm:text-lg",
          travelGradientText
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
