"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/types";

export function useRealtimeTasks(
  householdId: string | null,
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
) {
  useEffect(() => {
    if (!householdId) return;

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
          setTasks((prev) => {
            if (prev.some((t) => t.id === newTask.id)) return prev;
            // 仮IDのタスク（楽観的更新）があれば置換
            const tempIndex = prev.findIndex((t) => t.id.startsWith("temp-") && t.title === newTask.title);
            if (tempIndex !== -1) {
              return prev.map((t, i) => (i === tempIndex ? newTask : t));
            }
            return [newTask, ...prev];
          });
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
          setTasks((prev) =>
            prev.map((t) => (t.id === updated.id ? updated : t))
          );
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, setTasks]);
}
