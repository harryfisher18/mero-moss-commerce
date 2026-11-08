"use client";

import { useEffect } from "react";
import type { AnalyticsBeacon } from "@/domain/analytics/funnel";

/** Reports a funnel step once it is actually shown. Renders nothing; failures are ignored. */
export function TrackEvent({
  name,
  productHandle,
}: {
  name: "view_item" | "begin_checkout";
  productHandle?: string;
}) {
  useEffect(() => {
    const beacon: AnalyticsBeacon | null =
      name === "begin_checkout" ? { name } : productHandle ? { name, productHandle } : null;
    if (!beacon) return;
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(beacon),
      keepalive: true,
    }).catch(() => undefined);
  }, [name, productHandle]);
  return null;
}
