"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { runWhenIdle } from "@/lib/idle";

type PastTask = { title: string; category_id: string | null };

// サジェスト母集団として取得する過去タスクの件数
const PAST_TASKS_LIMIT = 500;
// 入力候補は多少古くても実害が無い一方、1 起動あたり 500 行の取得は通信量として無視できない。
// 長めの staleTime を置いて「起動のたびに取り直す」のをやめる。
const TITLE_SUGGESTIONS_STALE_TIME_MS = 60 * 60 * 1000;

/**
 * 過去のタスクタイトルを取得し、入力に応じたサジェスト候補を返すフック
 */
export function useTitleSuggestions(householdId: string | null) {
  const supabase = useMemo(() => createClient(), []);

  // 作成シートを開くまで不要な取得のため、起動クリティカルパスから外してアイドル後に発火させる
  const [isIdle, setIsIdle] = useState(false);
  useEffect(() => {
    if (!householdId) return;
    return runWhenIdle(() => setIsIdle(true));
  }, [householdId]);

  const fetchPastTasks = useCallback(async (): Promise<PastTask[]> => {
    if (!householdId) return [];

    const { data, error } = await supabase
      .from("tasks")
      .select("title, category_id")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(PAST_TASKS_LIMIT);

    if (error) throw error;

    // 重複を除去し、最新の表記を優先（最初に出現したものを残す）。
    // 取得直後に畳んでおくことで、キャッシュに載る量も減らす。
    const seen = new Set<string>();
    const unique: PastTask[] = [];
    for (const row of data ?? []) {
      const lower = row.title.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push({ title: row.title, category_id: row.category_id });
      }
    }
    return unique;
  }, [householdId, supabase]);

  // 変数名は getSuggestions の引数 query と衝突しないようにする
  const pastTasksQuery = useQuery({
    queryKey: queryKeys.titleSuggestions(householdId),
    queryFn: fetchPastTasks,
    enabled: !!householdId && isIdle,
    staleTime: TITLE_SUGGESTIONS_STALE_TIME_MS,
  });

  const pastTasks = useMemo(() => pastTasksQuery.data ?? [], [pastTasksQuery.data]);

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
