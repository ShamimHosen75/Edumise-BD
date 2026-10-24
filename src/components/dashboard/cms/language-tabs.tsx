"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Tab = {
  key: "en" | "bn";
  label: string;
  panel: React.ReactNode;
  hasError?: boolean;
};

/**
 * English / Bangla tabs (WAI-ARIA tabs: arrow keys move between tabs). Both panels stay
 * mounted so typed text is kept when switching.
 */
export function LanguageTabs({
  label,
  tabs,
  idPrefix,
}: {
  label: string;
  tabs: Tab[];
  idPrefix: string;
}) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusTab = (i: number) => {
    const next = (i + tabs.length) % tabs.length;
    setActive(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={label} className="flex gap-1 border-b">
        {tabs.map((tab, i) => (
          <button
            key={tab.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.key}`}
            aria-selected={i === active}
            aria-controls={`${idPrefix}-panel-${tab.key}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") focusTab(i + 1);
              if (e.key === "ArrowLeft") focusTab(i - 1);
            }}
            className={cn(
              "focus-visible:ring-ring/50 -mb-px border-b-2 px-4 py-2 text-sm font-medium outline-none focus-visible:ring-[3px]",
              i === active
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {tab.label}
            {tab.hasError ? (
              <span aria-hidden="true" className="text-destructive ml-1">
                ●
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`${idPrefix}-panel-${tab.key}`}
          aria-labelledby={`${idPrefix}-tab-${tab.key}`}
          hidden={i !== active}
          className="flex flex-col gap-4"
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
