"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";

import type { MenuEntry, MenuLink } from "@/lib/site/menu";
import { cn } from "@/lib/utils";

function NavLink({
  link,
  className,
  onNavigate,
}: {
  link: MenuLink;
  className?: string;
  onNavigate?: () => void;
}) {
  if (link.external) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {link.label}
        <ExternalLink className="ml-1 inline size-3" aria-hidden="true" />
      </a>
    );
  }
  return (
    <Link href={link.href} className={className} onClick={onNavigate}>
      {link.label}
    </Link>
  );
}

/**
 * Desktop menu: plain links, plus buttons that open a drop-down panel (a wide grid when a
 * menu has many items). Closes on Escape, on outside click and after navigating.
 */
export function DesktopNav({
  entries,
  label,
}: {
  entries: MenuEntry[];
  label: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(null), [pathname]);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const button = navRef.current?.querySelector<HTMLButtonElement>(
          `[data-menu="${open}"]`,
        );
        setOpen(null);
        button?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const item =
    "flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none";

  return (
    <nav ref={navRef} aria-label={label} className="hidden lg:block">
      <ul className="flex flex-wrap items-center gap-0.5">
        {entries.map((entry) => {
          if (entry.children.length === 0) {
            return (
              <li key={entry.id}>
                <NavLink
                  link={entry}
                  className={cn(
                    item,
                    pathname === entry.href && "text-primary",
                  )}
                />
              </li>
            );
          }
          const isOpen = open === entry.id;
          const wide = entry.children.length > 4;
          return (
            <li key={entry.id} className="relative">
              <button
                type="button"
                data-menu={entry.id}
                aria-expanded={isOpen}
                aria-controls={`menu-${entry.id}`}
                onClick={() => setOpen(isOpen ? null : entry.id)}
                className={cn(item, isOpen && "bg-accent")}
              >
                {entry.label}
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </button>
              {isOpen ? (
                <ul
                  id={`menu-${entry.id}`}
                  className={cn(
                    "bg-popover text-popover-foreground absolute top-full left-0 z-30 mt-1 grid gap-1 rounded-lg border p-2 shadow-lg",
                    wide ? "w-[32rem] grid-cols-2" : "w-60",
                  )}
                >
                  {entry.href ? (
                    <li className="col-span-full">
                      <NavLink
                        link={entry}
                        className="hover:bg-accent block rounded-md px-3 py-2 text-sm font-semibold"
                      />
                    </li>
                  ) : null}
                  {entry.children.map((child) => (
                    <li key={child.id}>
                      <NavLink
                        link={child}
                        className="hover:bg-accent block rounded-md px-3 py-2 text-sm"
                        onNavigate={() => setOpen(null)}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export { NavLink };
