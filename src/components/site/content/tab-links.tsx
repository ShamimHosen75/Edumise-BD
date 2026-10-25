import Link from "next/link";

import { cn } from "@/lib/utils";

/** Two or more tabs that are plain links (work without JavaScript, keep the URL shareable). */
export function TabLinks({
  label,
  tabs,
}: {
  label: string;
  tabs: { href: string; label: string; active: boolean }[];
}) {
  return (
    <nav
      aria-label={label}
      className="bg-muted flex w-fit max-w-full flex-wrap gap-1 rounded-lg p-1"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium",
            tab.active
              ? "bg-primary text-primary-foreground"
              : "hover:bg-accent",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
