"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Opens the browser's print dialog (the page prints on A4 landscape). */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-fit print:hidden"
      onClick={() => window.print()}
    >
      <Printer aria-hidden="true" />
      {label}
    </Button>
  );
}
