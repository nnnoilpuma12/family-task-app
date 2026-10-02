"use client";

import { useCallback, useMemo, useEffect } from "react";
import { useQuery, useQueryClient, type QueryFunctionContext } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { createQueryRefresh } from "@/lib/query-refresh";
import { queryKeys } from "@/lib/query-keys";
import { useIdleReady } from "@/hooks/use-idle-ready";
import type { TaskRecommendation } from "@/types";

// 完了履歴を集計する重い RPC なので、この時間内の再マウント・フォーカス復帰では取り直さない。
// タスク操作時は refetch() で再取得を予約し、最後の変更から 2 秒後にまとめて集計する。
const RECOMMENDATIONS_STALE_TIME_MS = 10 * 60 * 1000;

export function useTaskRecommendations(householdId: string | null, profileId?: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  // 起動クリティカルパスから外してアイドル後に発火させる（RPC が重いため）
  const { isReady, markReady } = useIdleReady(!!householdId);

  const fetchRecommendations = useCallback(async ({ signal }: QueryFunctionContext): Promise<TaskRecommendation[]> => {
    const { data, error } = await supabase.rpc("get_recurring_recommendations").abortSignal(signal);
    if (error) throw error;
    return data ?? [];
  }, [supabase]);

  // React Query 経由にすることで、起動のたびに RPC を叩くのをやめる
  // （localStorage への永続化も効くので、再訪時はキャッシュから即時表示される）
  const query = useQuery({
    queryKey: queryKeys.recommendations(householdId),
    queryFn: fetchRecommendations,
    enabled: !!householdId && isReady,
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

  // 自分の操作とその Realtime echo、連続操作を同じ 2 秒の窓でまとめる。
  const refresh = useMemo(
    () => createQueryRefresh(queryClient, queryKeys.recommendations(householdId), 2000),
    [queryClient, householdId]
  );
  useEffect(() => () => refresh.cancel(), [refresh]);
  const refetch = useCallback(() => {
    if (!householdId) return;
    markReady();
    // 予約中に画面を離れても、次のマウントで古い候補を10分間使い続けない。
    void queryClient.invalidateQueries({ queryKey: queryKeys.recommendations(householdId), refetchType: "none" });
    refresh.request();
  }, [householdId, markReady, refresh, queryClient]);

  return { recommendations, loading, dismiss, refetch };
}
