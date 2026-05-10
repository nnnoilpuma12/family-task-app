"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StapleItem } from "@/types";

export function useRealtimeStapleItems(
  householdId: string | null,
  setStapleItems: React.Dispatch<React.SetStateAction<StapleItem[]>>
) {
  useEffect(() => {
    if (!householdId) return;

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
  }, [householdId, setStapleItems]);
}
