"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  FileText,
  Home,
  ListTree,
  Menu,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { isActive, type NavIcon, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<NavIcon, LucideIcon> = {
  home: Home,
  settings: Settings,
  pages: FileText,
  menu: ListTree,
};

export type NavLink = Pick<NavItem, "key" | "href" | "icon"> & {
  label: string;
};

function NavLinks({
  lang,
  items,
  onNavigate,
}: {
  lang: string;
  items: NavLink[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "";
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(item, pathname, lang);
        return (
          <li key={item.key}>
            <Link
              href={`/${lang}/dashboard${item.href}`}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                active &&
                  "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Permanent sidebar on medium screens and up. */
export function DashboardSidebar({
  lang,
  items,
  label,
}: {
  lang: string;
  items: NavLink[];
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className="hidden w-56 shrink-0 border-r p-3 md:block"
    >
      <NavLinks lang={lang} items={items} />
    </nav>
  );
}

type MobileProps = {
  lang: string;
  items: NavLink[];
  labels: { nav: string; menu: string; close: string };
};

/** Menu button and drop-down panel on phones. */
export function DashboardMobileNav({ lang, items, labels }: MobileProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <Button
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-controls="dashboard-nav-mobile"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        <span className="sr-only sm:not-sr-only">
          {open ? labels.close : labels.menu}
        </span>
      </Button>
      {open ? (
        <nav
          id="dashboard-nav-mobile"
          aria-label={labels.nav}
          className="bg-background absolute inset-x-0 top-14 z-20 border-b p-3 shadow-md"
        >
          <NavLinks
            lang={lang}
            items={items}
            onNavigate={() => setOpen(false)}
          />
        </nav>
      ) : null}
    </div>
  );
}
