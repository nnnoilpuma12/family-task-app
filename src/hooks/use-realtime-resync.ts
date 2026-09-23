"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

// 再同期の最小間隔。online は不安定な回線で連続発火しうるため、
// 立て続けの invalidate で取得を積み上げないよう下限を設ける。
const RESYNC_MIN_INTERVAL_MS = 2000;

/**
 * Realtime の取りこぼしを回収するための再同期ゲート。
 *
 * WebSocket は端末のスリープ・アプリ切り替え・回線切り替えで無言のまま切れる。
 * postgres_changes には切断中のイベントを再送する仕組みが無いので、
 * 復帰しただけでは画面は古いまま固まる。
 *
 * React Query の refetchOnWindowFocus は本来この保険になるはずだが、
 * 既定の staleTime（30 秒）を過ぎたクエリしか取り直さない。さらに
 * setQueryData はそのたび dataUpdatedAt を更新するため、Realtime イベントや
 * 楽観的更新を受けるたびに staleTime のタイマーが振り出しに戻る。
 * 結果、操作が活発なときほど保険が効かなくなる。
 *
 * そこで可視化・オンライン復帰を直接拾い、世帯スコープのクエリを
 * 明示的に invalidate する。同一キーの取得は React Query 側で
 * 重複排除されるため、refetchOnWindowFocus と二重には走らない。
 */
export function useRealtimeResync(householdId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!householdId) return;

    // 効果の生存期間で共有するスロットル状態（ref を使わず closure に閉じる）
    let lastResyncAt = 0;

    const resync = () => {
      // 非表示のあいだに取り直しても見えないうえ、復帰時にどのみち走る
      if (document.visibilityState !== "visible") return;

      const now = Date.now();
      if (now - lastResyncAt < RESYNC_MIN_INTERVAL_MS) return;
      lastResyncAt = now;

      // レコメンドは意図的に staleTime を長く取った重い RPC なので対象外
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(householdId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.categories(householdId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.stapleItems(householdId) });
    };

    document.addEventListener("visibilitychange", resync);
    window.addEventListener("online", resync);

    return () => {
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("online", resync);
    };
  }, [householdId, queryClient]);
}
