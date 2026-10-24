import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { pageNumbers } from "@/lib/content/pagination";
import { cn } from "@/lib/utils";

type Props = {
  page: number;
  total: number;
  /** Builds the link for a page number (keeps the current search and filters). */
  href: (page: number) => string;
  labels: {
    nav: string;
    previous: string;
    next: string;
    pageN: (n: number) => string;
  };
  digits: (n: number) => string;
};

export function Pagination({ page, total, href, labels, digits }: Props) {
  if (total <= 1) return null;
  const item =
    "flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm hover:bg-accent";
  return (
    <nav aria-label={labels.nav} className="flex flex-wrap items-center gap-1">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={item}>
          <ChevronLeft className="size-4" aria-hidden="true" />
          {labels.previous}
        </Link>
      ) : null}
      {pageNumbers(page, total).map((n, i) =>
        n === null ? (
          <span
            key={`gap-${i}`}
            aria-hidden="true"
            className="text-muted-foreground px-1"
          >
            …
          </span>
        ) : (
          <Link
            key={n}
            href={href(n)}
            aria-label={labels.pageN(n)}
            aria-current={n === page ? "page" : undefined}
            className={cn(
              item,
              n === page &&
                "border-primary bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            {digits(n)}
          </Link>
        ),
      )}
      {page < total ? (
        <Link href={href(page + 1)} rel="next" className={item}>
          {labels.next}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </nav>
  );
}

/** Query string for a list page, dropping empty values and page 1. */
export function listHref(
  base: string,
  params: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || (key === "page" && value === 1))
      continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}
