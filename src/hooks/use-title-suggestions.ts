"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 過去のタスクタイトルを取得し、入力に応じたサジェスト候補を返すフック
 */
export function useTitleSuggestions(householdId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [pastTitles, setPastTitles] = useState<string[]>([]);

  useEffect(() => {
    if (!householdId) return;

    (async () => {
      const { data } = await supabase
        .from("tasks")
        .select("title")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (data) {
        // 重複を除去し、最新の表記を優先（最初に出現したものを残す）
        const seen = new Set<string>();
        const unique: string[] = [];
        for (const row of data) {
          const lower = row.title.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            unique.push(row.title);
          }
        }
        setPastTitles(unique);
      }
    })();
  }, [householdId, supabase]);

  const getSuggestions = useCallback(
    (query: string, maxResults = 5): string[] => {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      return pastTitles
        .filter((t) => t.toLowerCase().includes(q))
        .slice(0, maxResults);
    },
    [pastTitles]
  );

  return { getSuggestions, pastTitles };
}
