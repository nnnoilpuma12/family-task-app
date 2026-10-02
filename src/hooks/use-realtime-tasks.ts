"use client";

import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useIdleReady } from "@/hooks/use-idle-ready";
import { createSubscribeHandler } from "@/lib/realtime";
import type { Task } from "@/types";

export function useRealtimeTasks(
  householdId: string | null,
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>,
  onRemoteChange?: () => void,
  /** 購読が成立したときに呼ばれる。切断中に取りこぼしたイベントを取得で回収する */
  onResync?: () => void
) {
  const queryClient = useQueryClient();
  // Realtime の WebSocket ハンドシェイク（HTTP アップグレード + 認証）は、
  // 起動直後に張ると初期クエリと接続・帯域を食い合う。初回ペイント後まで遅らせる。
  // 取得スナップショットと購読開始のあいだのイベントを取りこぼす窓は元々存在し
  // （同時に開始しても取得結果は購読前の状態）、アイドルは初回ペイント直後に
  // 来るため窓の広がりはわずか。この窓と、以降の切断による取りこぼしは
  // 購読成立時の onResync で回収する。
  const { isReady } = useIdleReady(!!householdId);

  useEffect(() => {
    if (!householdId || !isReady) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`tasks:${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tasks",
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const newTask = payload.new as Task;
          const exists = queryClient.getQueryData<Task[]>(queryKeys.tasks(householdId))?.some((t) => t.id === newTask.id);
          setTasks((prev) => {
            if (prev.some((t) => t.id === newTask.id)) return prev;
            return [newTask, ...prev];
          });
          if (!exists) onRemoteChange?.();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const updated = payload.new as Task;
          const previous = queryClient.getQueryData<Task[]>(queryKeys.tasks(householdId))?.find((t) => t.id === updated.id);
          // RPC が参照する列だけを見る。並び替え・URL・期限だけの変更では集計しない。
          const relevantFields = ["title", "is_done", "completed_at", "category_id", "memo"] as const;
          const affectsRecommendations = !previous || relevantFields.some((key) => previous[key] !== updated[key]);
          setTasks((prev) =>
            prev.map((t) => (t.id === updated.id ? updated : t))
          );
          if (affectsRecommendations) onRemoteChange?.();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "tasks",
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const deleted = payload.old as { id: string };
          setTasks((prev) => prev.filter((t) => t.id !== deleted.id));
          onRemoteChange?.();
        }
      )
      .subscribe(createSubscribeHandler(`tasks:${householdId}`, onResync));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, isReady, setTasks, onRemoteChange, onResync, queryClient]);
}
