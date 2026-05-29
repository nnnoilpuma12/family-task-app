"use client";

import { useEffect, useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { sendPushNotification } from "@/lib/push";
import type { Task } from "@/types";

// 未完了タスクは全件、完了済みはこの日数以内のものだけ初期ロードする（蓄積による起動遅延を防ぐ）
const COMPLETED_TASKS_WINDOW_DAYS = 30;
// 「もっと見る」で追加取得する古い完了済みタスクの 1 ページ件数
const COMPLETED_PAGE_SIZE = 30;

export function useTasks(householdId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const [hasMoreCompleted, setHasMoreCompleted] = useState(true);
  const [loadingMoreCompleted, setLoadingMoreCompleted] = useState(false);

  const fetchTasks = useCallback(async (): Promise<Task[]> => {
    if (!householdId) return [];

    const completedCutoff = new Date(
      Date.now() - COMPLETED_TASKS_WINDOW_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("household_id", householdId)
      .or(`is_done.eq.false,completed_at.gte.${completedCutoff}`)
      .order("is_done")
      .order("sort_order")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }, [householdId, supabase]);

  const query = useQuery({
    queryKey: queryKeys.tasks(householdId),
    queryFn: fetchTasks,
    enabled: !!householdId,
  });

  const tasks = useMemo(() => query.data ?? [], [query.data]);
  // householdId 確定前は skeleton を維持する（query は disabled で isLoading=false になるため）
  const loading = !householdId || query.isLoading;

  useEffect(() => {
    if (query.isError) toast.error("タスクの取得に失敗しました");
  }, [query.isError]);

  // 既存の setTasks 互換 API。Realtime フックや楽観的更新はこの関数経由で
  // React Query キャッシュを更新する（ページ遷移をまたいで状態が永続する）
  const setTasks = useCallback<React.Dispatch<React.SetStateAction<Task[]>>>(
    (update) => {
      queryClient.setQueryData<Task[]>(queryKeys.tasks(householdId), (old) => {
        const prev = old ?? [];
        return typeof update === "function"
          ? (update as (p: Task[]) => Task[])(prev)
          : update;
      });
    },
    [queryClient, householdId]
  );

  // 世帯が切り替わったら古い完了済みの追加ロード状態をリセットする
  // （render 中に前回値と比較して調整する React 推奨パターン。TaskList と同じ）
  const [prevHouseholdId, setPrevHouseholdId] = useState(householdId);
  if (prevHouseholdId !== householdId) {
    setPrevHouseholdId(householdId);
    setHasMoreCompleted(true);
    setLoadingMoreCompleted(false);
  }

  // 初期ロードの 30 日ウィンドウより古い完了済みタスクを段階的に取得する。
  // 取得済みの最古 completed_at をカーソルにして completed_at 降順でページングし、
  // id dedupe したうえでキャッシュ末尾へ追記する（並び替え・Realtime には影響しない）。
  const loadMoreCompleted = useCallback(async () => {
    if (!householdId) return;
    setLoadingMoreCompleted(true);

    const current = queryClient.getQueryData<Task[]>(queryKeys.tasks(householdId)) ?? [];
    const oldestCompletedAt = current.reduce<string | null>((min, t) => {
      if (!t.is_done || !t.completed_at) return min;
      return min === null || t.completed_at < min ? t.completed_at : min;
    }, null);

    let builder = supabase
      .from("tasks")
      .select("*")
      .eq("household_id", householdId)
      .eq("is_done", true)
      .not("completed_at", "is", null);
    if (oldestCompletedAt) {
      builder = builder.lt("completed_at", oldestCompletedAt);
    }

    const { data, error } = await builder
      .order("completed_at", { ascending: false })
      .limit(COMPLETED_PAGE_SIZE);

    if (error) {
      toast.error("完了済みタスクの取得に失敗しました");
      setLoadingMoreCompleted(false);
      return;
    }

    const batch = data ?? [];
    if (batch.length < COMPLETED_PAGE_SIZE) {
      setHasMoreCompleted(false);
    }
    if (batch.length > 0) {
      setTasks((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const additions = batch.filter((t) => !existingIds.has(t.id));
        return [...prev, ...additions];
      });
    }
    setLoadingMoreCompleted(false);
  }, [householdId, supabase, queryClient, setTasks]);

  const addTask = async (task: {
    title: string;
    category_id?: string | null;
    due_date?: string | null;
    memo?: string | null;
    url?: string | null;
    created_by?: string | null;
  }) => {
    if (!householdId) return;

    // Optimistic update with client-generated UUID (same ID used for DB insert)
    const taskId = crypto.randomUUID();
    const now = new Date().toISOString();
    const optimisticTask: Task = {
      id: taskId,
      title: task.title,
      category_id: task.category_id ?? null,
      due_date: task.due_date ?? null,
      memo: task.memo ?? null,
      url: task.url ?? null,
      created_by: task.created_by ?? null,
      household_id: householdId,
      is_done: false,
      sort_order: 0,
      completed_at: null,
      created_at: now,
      updated_at: now,
    };

    setTasks((prev) => [optimisticTask, ...prev]);

    const { data, error } = await supabase
      .from("tasks")
      .insert({ id: taskId, ...task, household_id: householdId })
      .select()
      .single();

    if (error) {
      // Rollback: remove optimistic task
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast.error("タスクの追加に失敗しました");
    } else if (data) {
      // Update optimistic task with server data (ID is already the same)
      setTasks((prev) => prev.map((t) => (t.id === taskId ? data : t)));
      sendPushNotification({
        title: "家族タスク",
        body: `「${data.title}」が追加されました`,
        householdId,
      });
    }
    return { data, error };
  };

  const updateTask = async (id: string, updates: Partial<Task>, options?: { skipNotification?: boolean }) => {
    // If marking as done, set completed_at
    if (updates.is_done === true) {
      updates.completed_at = new Date().toISOString();
    } else if (updates.is_done === false) {
      updates.completed_at = null;
    }

    // Whitelist allowed fields to prevent unintended column updates
    const allowedFields = [
      "title", "memo", "url", "due_date", "is_done", "completed_at",
      "category_id", "sort_order",
    ] as const;
    const sanitized: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updates) {
        sanitized[key] = updates[key as keyof Task];
      }
    }

    // Optimistic update
    let snapshot = tasks;
    setTasks((prev) => {
      snapshot = prev;
      return prev.map((t) => (t.id === id ? { ...t, ...updates } : t));
    });

    const { data, error } = await supabase
      .from("tasks")
      .update(sanitized)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      // Rollback
      setTasks(snapshot);
      toast.error("タスクの更新に失敗しました");
    } else if (data) {
      // Sync with server data
      setTasks((prev) => prev.map((t) => (t.id === id ? data : t)));
      if (!options?.skipNotification && householdId) {
        sendPushNotification({
          title: "家族タスク",
          body: `「${data.title}」が更新されました`,
          householdId,
        });
      }
    }
    return { data, error };
  };

  const deleteTask = async (id: string, options?: { skipToast?: boolean }) => {
    // Optimistic update: remove task immediately
    const previousTasks = tasks;
    const deletedTask = previousTasks.find((t) => t.id === id);
    setTasks((prev) => prev.filter((t) => t.id !== id));

    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (error) {
      // Rollback
      setTasks(previousTasks);
      if (!options?.skipToast) {
        toast.error("タスクの削除に失敗しました");
      }
    } else if (deletedTask && !options?.skipToast) {
      toast("タスクを削除しました", {
        action: {
          label: "元に戻す",
          onClick: () => {
            supabase
              .from("tasks")
              .insert(deletedTask)
              .then(({ error: insertError }) => {
                if (!insertError) {
                  setTasks((prev) => [deletedTask, ...prev]);
                } else {
                  toast.error("元に戻せませんでした");
                }
              });
          },
        },
        duration: 4000,
      });
    }
    return { error };
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const result = await updateTask(id, { is_done: !task.is_done }, { skipNotification: true });
    if (!task.is_done && result?.data) {
      sendPushNotification({
        title: "家族タスク",
        body: `「${task.title}」が完了しました`,
        householdId: householdId!,
      });
    }
    return result;
  };

  const reorderTasks = async (orderedIds: string[]) => {
    // Optimistic update
    let snapshot = tasks;
    setTasks((prev) => {
      snapshot = prev;
      const idToTask = new Map(prev.map((t) => [t.id, t]));
      const reordered = orderedIds.map((id, i) => ({ ...idToTask.get(id)!, sort_order: i }));
      const rest = prev.filter((t) => !orderedIds.includes(t.id));
      return [...reordered, ...rest];
    });

    const { error } = await supabase.rpc("reorder_tasks", {
      p_task_ids: orderedIds,
      p_sort_orders: orderedIds.map((_, i) => i),
    });
    if (error) {
      setTasks(snapshot);
      toast.error("タスクの並び替えに失敗しました");
    }
  };

  return { tasks, setTasks, loading, addTask, updateTask, deleteTask, toggleTask, reorderTasks, loadMoreCompleted, hasMoreCompleted, loadingMoreCompleted, refetch: query.refetch };
}
