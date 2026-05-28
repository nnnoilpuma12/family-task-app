"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { runWhenIdle } from "@/lib/idle";
import type { TaskRecommendation } from "@/types";

export function useTaskRecommendations(householdId: string | null, profileId?: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  // 完了タスク全走査で重い RPC のため、起動クリティカルパスから外してアイドル後に有効化する
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    if (!householdId) return;
    return runWhenIdle(() => setIdle(true));
  }, [householdId]);

  const query = useQuery({
    queryKey: queryKeys.recommendations(householdId),
    queryFn: async (): Promise<TaskRecommendation[]> => {
      const { data, error } = await supabase.rpc("get_recurring_recommendations");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!householdId && idle,
  });

  const recommendations = useMemo(() => query.data ?? [], [query.data]);
  const loading = !householdId || !idle || query.isLoading;

  const dismiss = useCallback(
    async (normalizedTitle: string, medianDays: number) => {
      if (!householdId) return;

      // 楽観的にローカルキャッシュから削除
      queryClient.setQueryData<TaskRecommendation[]>(
        queryKeys.recommendations(householdId),
        (old) => (old ?? []).filter((r) => r.normalized_title !== normalizedTitle)
      );

      const dismissedUntil = new Date();
      dismissedUntil.setDate(dismissedUntil.getDate() + medianDays);

      await supabase.from("dismissed_recommendations").upsert(
        {
          household_id: householdId,
          normalized_title: normalizedTitle,
          dismissed_until: dismissedUntil.toISOString(),
          ...(profileId ? { dismissed_by: profileId } : {}),
        },
        { onConflict: "household_id,normalized_title" }
      );
    },
    [householdId, profileId, supabase, queryClient]
  );

  return { recommendations, loading, dismiss, refetch: query.refetch };
}
