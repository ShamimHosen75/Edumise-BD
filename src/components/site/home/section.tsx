import Link from "next/link";

import { cn } from "@/lib/utils";

/** A titled home page section. */
export function Section({
  id,
  title,
  children,
  className,
  more,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
  /** Link to the full list, shown beside the title. */
  more?: { href: string; label: string };
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn("flex flex-col gap-4", className)}
      data-section={id}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id={`${id}-title`}
          className="flex items-center gap-2 text-xl font-semibold"
        >
          <span
            aria-hidden="true"
            className="bg-primary h-6 w-1.5 rounded-full"
          />
          {title}
        </h2>
        {more ? (
          <Link
            href={more.href}
            className="text-primary text-sm font-medium hover:underline"
          >
            {more.label} →
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
