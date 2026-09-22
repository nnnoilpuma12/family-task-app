"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useIdleReady } from "@/hooks/use-idle-ready";
import { createSubscribeHandler } from "@/lib/realtime";
import type { Category } from "@/types";

/** sort_order 昇順を保つ（カテゴリはタブの並びそのものなので順序が見える） */
function sortByOrder(items: Category[]): Category[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * カテゴリの Realtime 購読。
 *
 * categories は 001 の時点で supabase_realtime に publish されていたが、
 * 購読するフックが無く、配信コストだけ払って誰も受け取っていなかった。
 * そのためパートナーがカテゴリを追加・改名・削除しても相手のタブは変わらない。
 */
export function useRealtimeCategories(
  householdId: string | null,
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>,
  /** 購読が成立したときに呼ばれる。切断中に取りこぼしたイベントを取得で回収する */
  onResync?: () => void
) {
  // tasks / staple_items と同じく、初回ペイント後まで購読を遅らせる
  // （WebSocket のハンドシェイクを初期取得と食い合わせない）
  const { isReady } = useIdleReady(!!householdId);

  useEffect(() => {
    if (!householdId || !isReady) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`categories:${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "categories",
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const newCategory = payload.new as Category;
          setCategories((prev) => {
            if (prev.some((c) => c.id === newCategory.id)) return prev;
            return sortByOrder([...prev, newCategory]);
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "categories",
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const updated = payload.new as Category;
          setCategories((prev) =>
            sortByOrder(prev.map((c) => (c.id === updated.id ? updated : c)))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "categories",
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const deleted = payload.old as { id: string };
          setCategories((prev) => prev.filter((c) => c.id !== deleted.id));
        }
      )
      .subscribe(createSubscribeHandler(`categories:${householdId}`, onResync));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, isReady, setCategories, onResync]);
}
