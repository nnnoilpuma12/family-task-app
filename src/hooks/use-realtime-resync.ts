"use client";

import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { createQueryRefresh } from "@/lib/query-refresh";

/** 購読成立・可視化・online の再取得を、世帯とクエリごとに集約する。 */
export function useRealtimeResync(householdId: string | null) {
  const client = useQueryClient();
  const refresh = useMemo(() => ({
    tasks: createQueryRefresh(client, queryKeys.tasks(householdId), 50),
    categories: createQueryRefresh(client, queryKeys.categories(householdId), 50),
    stapleItems: createQueryRefresh(client, queryKeys.stapleItems(householdId), 50),
  }), [client, householdId]);

  useEffect(() => {
    if (!householdId) return;
    let lastResyncAt = -Infinity;
    const resync = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastResyncAt < 2000) return;
      lastResyncAt = now;
      refresh.tasks.request();
      refresh.categories.request();
      refresh.stapleItems.request();
    };
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("online", resync);
    return () => {
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("online", resync);
      Object.values(refresh).forEach((entry) => entry.cancel());
    };
  }, [householdId, refresh]);

  return useMemo(() => ({
    tasks: refresh.tasks.request,
    categories: refresh.categories.request,
    stapleItems: refresh.stapleItems.request,
  }), [refresh]);
}
