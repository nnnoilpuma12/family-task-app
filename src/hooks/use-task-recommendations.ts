"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TaskRecommendation } from "@/types";

export function useTaskRecommendations(householdId: string | null, profileId?: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [recommendations, setRecommendations] = useState<TaskRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecommendations = useCallback(async () => {
    if (!householdId) return;
    const { data, error } = await supabase.rpc("get_recurring_recommendations", {
      p_household_id: householdId,
    });

    if (!error && data) {
      setRecommendations(data);
    }
    setLoading(false);
  }, [householdId, supabase]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const dismiss = useCallback(
    async (normalizedTitle: string, medianDays: number) => {
      if (!householdId) return;

      // 楽観的にローカルstateから削除
      setRecommendations((prev) =>
        prev.filter((r) => r.normalized_title !== normalizedTitle)
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
    [householdId, profileId, supabase]
  );

  return { recommendations, loading, dismiss, refetch: fetchRecommendations };
}
