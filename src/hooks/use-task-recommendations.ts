"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { runWhenIdle } from "@/lib/idle";
import type { TaskRecommendation } from "@/types";

// 完了履歴を集計する重い RPC なので、この時間内の再マウント・フォーカス復帰では取り直さない。
// レコメンドの元になるタスク操作（追加・完了・削除）の直後は refetch() で明示的に
// 取り直すため、鮮度はこの値に縛られない。
const RECOMMENDATIONS_STALE_TIME_MS = 10 * 60 * 1000;

export function useTaskRecommendations(householdId: string | null, profileId?: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  // 起動クリティカルパスから外してアイドル後に発火させる（RPC が重いため）
  const [isIdle, setIsIdle] = useState(false);
  useEffect(() => {
    if (!householdId) return;
    return runWhenIdle(() => setIsIdle(true));
  }, [householdId]);

  const fetchRecommendations = useCallback(async (): Promise<TaskRecommendation[]> => {
    const { data, error } = await supabase.rpc("get_recurring_recommendations");
    if (error) throw error;
    return data ?? [];
  }, [supabase]);

  // React Query 経由にすることで、起動のたびに RPC を叩くのをやめる
  // （localStorage への永続化も効くので、再訪時はキャッシュから即時表示される）
  const query = useQuery({
    queryKey: queryKeys.recommendations(householdId),
    queryFn: fetchRecommendations,
    enabled: !!householdId && isIdle,
    staleTime: RECOMMENDATIONS_STALE_TIME_MS,
  });

  const recommendations = useMemo(() => query.data ?? [], [query.data]);
  // householdId 未確定・アイドル待ちのあいだは pending のまま維持する
  // （レコメンド枠が「無し」で一瞬描画されるのを避ける）。エラー時は false になる。
  const loading = query.isPending;

  const dismiss = useCallback(
    async (normalizedTitle: string, medianDays: number) => {
      if (!householdId) return;

      // 楽観的にキャッシュから除去
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

  // タスクの追加・完了・削除の直後に呼ばれる。まだアイドル待ちでもここで有効化して取り直す。
  const refetch = useCallback(async () => {
    if (!householdId) return;
    setIsIdle(true);
    await queryClient.invalidateQueries({
      queryKey: queryKeys.recommendations(householdId),
    });
  }, [householdId, queryClient]);

  return { recommendations, loading, dismiss, refetch };
}
