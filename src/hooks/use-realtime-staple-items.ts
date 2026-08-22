"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useIdleReady } from "@/hooks/use-idle-ready";
import type { StapleItem } from "@/types";

export function useRealtimeStapleItems(
  householdId: string | null,
  setStapleItems: React.Dispatch<React.SetStateAction<StapleItem[]>>
) {
  // Realtime の WebSocket ハンドシェイク（HTTP アップグレード + 認証）は、
  // 起動直後に張ると初期クエリと接続・帯域を食い合う。初回ペイント後まで遅らせる。
  // 取得スナップショットと購読開始のあいだのイベントを取りこぼす窓は元々存在し
  // （同時に開始しても取得結果は購読前の状態）、アイドルは初回ペイント直後に
  // 来るため窓の広がりはわずか。取りこぼしは refetchOnWindowFocus で回収される。
  const { isReady } = useIdleReady(!!householdId);

  useEffect(() => {
    if (!householdId || !isReady) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`staple_items:${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "staple_items",
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const newItem = payload.new as StapleItem;
          setStapleItems((prev) => {
            if (prev.some((si) => si.id === newItem.id)) return prev;
            return [...prev, newItem];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "staple_items",
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const updated = payload.new as StapleItem;
          setStapleItems((prev) =>
            prev.map((si) => (si.id === updated.id ? updated : si))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "staple_items",
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const deleted = payload.old as { id: string };
          setStapleItems((prev) => prev.filter((si) => si.id !== deleted.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, isReady, setStapleItems]);
}
