import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

/** Round photo (or initials) with a name and short lines under it. */
export function PersonCard({
  name,
  photo,
  lines,
  href,
  size = "md",
  className,
}: {
  name: string;
  photo: string | null;
  lines: (string | null | undefined)[];
  /** Makes the whole card a link (to a profile). */
  href?: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const box = size === "lg" ? "size-28" : "size-20";
  return (
    <div
      className={cn(
        "bg-card relative flex h-full flex-col items-center gap-2 rounded-xl border p-4 text-center",
        href &&
          "hover:border-primary focus-within:ring-ring/50 focus-within:ring-[3px]",
        className,
      )}
    >
      {photo ? (
        <Image
          src={photo}
          alt=""
          width={size === "lg" ? 160 : 112}
          height={size === "lg" ? 160 : 112}
          className={cn(box, "rounded-full object-cover")}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            box,
            "bg-primary/10 text-primary flex items-center justify-center rounded-full text-xl font-semibold",
          )}
        >
          {initials(name)}
        </span>
      )}
      <p className="text-sm leading-tight font-semibold">
        {href ? (
          <Link
            href={href}
            className="outline-none after:absolute after:inset-0 hover:underline"
          >
            {name}
          </Link>
        ) : (
          name
        )}
      </p>
      {lines
        .filter((l): l is string => Boolean(l))
        .map((line, i) => (
          <p
            key={i}
            className={cn("text-xs", i === 0 && "text-muted-foreground")}
          >
            {line}
          </p>
        ))}
    </div>
  );
}
