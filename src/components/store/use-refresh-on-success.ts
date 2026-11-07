"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { CartActionState } from "@/app/(store)/cart/actions";

/**
 * After a successful cart mutation, re-fetch the current route so request-time data
 * (cart lines, totals, header count) reflects the change. Each action returns a new state
 * object, so repeated successes still trigger a refresh.
 */
export function useRefreshOnSuccess(state: CartActionState) {
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);
}
