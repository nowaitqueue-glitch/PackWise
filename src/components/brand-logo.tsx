import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  href?: string | null;
  className?: string;
};

export function BrandLogo({ href = "/", className }: BrandLogoProps) {
  const content = (
    <>
      <Image
        src="/images/logo.png"
        alt="PackWise"
        width={40}
        height={40}
        className="h-10 w-auto"
        priority
      />
      <span className="hidden text-lg font-semibold tracking-tight text-foreground sm:inline">
        PackWise
      </span>
    </>
  );

  const classes = cn("inline-flex items-center gap-2", className);

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}
