"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/** While a payment waits for the gateway: look again every few seconds, for a minute. */
export function RefreshWhileWaiting({ label }: { label: string }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      router.refresh();
      if (n >= 20) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [router]);
  return (
    <Button
      type="button"
      variant="outline"
      className="w-fit"
      onClick={() => router.refresh()}
    >
      {label}
    </Button>
  );
}
