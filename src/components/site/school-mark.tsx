import Image from "next/image";

import { cn } from "@/lib/utils";

/** The school logo, or its initials in the brand colour when no logo is uploaded. */
export function SchoolMark({
  logoUrl,
  initials,
  alt,
  size = 48,
  className,
}: {
  logoUrl: string | null;
  initials: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={alt}
        width={size}
        height={size}
        unoptimized
        className={cn("shrink-0 object-contain", className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cn(
        "bg-primary text-primary-foreground flex shrink-0 items-center justify-center rounded-full text-sm font-bold",
        className,
      )}
    >
      {initials.slice(0, 3)}
    </span>
  );
}
