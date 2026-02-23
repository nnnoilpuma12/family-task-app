"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/types";

export function useTasks(householdId: string | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!householdId) return;
    const supabase = createClient();

    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("household_id", householdId)
      .order("is_done")
      .order("sort_order")
      .order("created_at", { ascending: false });

    if (data) setTasks(data);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = async (task: {
    title: string;
    category_id?: string | null;
    due_date?: string | null;
    memo?: string | null;
    url?: string | null;
    created_by?: string | null;
  }) => {
    if (!householdId) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks")
      .insert({ ...task, household_id: householdId })
      .select()
      .single();

    if (!error && data) {
      setTasks((prev) => {
        if (prev.some((t) => t.id === data.id)) return prev;
        return [data, ...prev];
      });
      // Send push notification (fire-and-forget)
      fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "家族タスク",
          body: `「${data.title}」が追加されました`,
          householdId: householdId,
        }),
      }).catch(() => {});
    }
    return { data, error };
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const supabase = createClient();
    // If marking as done, set completed_at
    if (updates.is_done === true) {
      updates.completed_at = new Date().toISOString();
    } else if (updates.is_done === false) {
      updates.completed_at = null;
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (!error && data) {
      setTasks((prev) => prev.map((t) => (t.id === id ? data : t)));
    }
    return { data, error };
  };

  const deleteTask = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
    return { error };
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const result = await updateTask(id, { is_done: !task.is_done });
    // Send push notification when task is completed (fire-and-forget)
    if (!task.is_done && result?.data) {
      fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "家族タスク",
          body: `「${task.title}」が完了しました`,
          householdId: householdId,
        }),
      }).catch(() => {});
    }
    return result;
  };

  const reorderTasks = async (orderedIds: string[]) => {
    // Optimistic update
    setTasks((prev) => {
      const idToTask = new Map(prev.map((t) => [t.id, t]));
      const reordered = orderedIds.map((id, i) => ({ ...idToTask.get(id)!, sort_order: i }));
      const rest = prev.filter((t) => !orderedIds.includes(t.id));
      return [...reordered, ...rest];
    });

    const supabase = createClient();
    await supabase.rpc("reorder_tasks", {
      p_task_ids: orderedIds,
      p_sort_orders: orderedIds.map((_, i) => i),
    });
  };

  return { tasks, setTasks, loading, addTask, updateTask, deleteTask, toggleTask, reorderTasks, refetch: fetchTasks };
}
