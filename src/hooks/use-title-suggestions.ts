"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type PastTask = { title: string; category_id: string | null };

/**
 * 過去のタスクタイトルを取得し、入力に応じたサジェスト候補を返すフック
 */
export function useTitleSuggestions(householdId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [pastTasks, setPastTasks] = useState<PastTask[]>([]);

  useEffect(() => {
    if (!householdId) return;

    (async () => {
      const { data } = await supabase
        .from("tasks")
        .select("title, category_id")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (data) {
        // 重複を除去し、最新の表記を優先（最初に出現したものを残す）
        const seen = new Set<string>();
        const unique: PastTask[] = [];
        for (const row of data) {
          const lower = row.title.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            unique.push({ title: row.title, category_id: row.category_id });
          }
        }
        setPastTasks(unique);
      }
    })();
  }, [householdId, supabase]);

  const getSuggestions = useCallback(
    (query: string, categoryId?: string | null, maxResults = 5): string[] => {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      const pool = categoryId
        ? pastTasks.filter((t) => t.category_id === categoryId)
        : pastTasks;
      return pool
        .filter((t) => t.title.toLowerCase().includes(q))
        .map((t) => t.title)
        .slice(0, maxResults);
    },
    [pastTasks]
  );

  return { getSuggestions };
}
