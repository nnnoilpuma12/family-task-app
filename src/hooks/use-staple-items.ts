"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { StapleItem } from "@/types";

export function useStapleItems(householdId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [stapleItems, setStapleItems] = useState<StapleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStapleItems = useCallback(async () => {
    if (!householdId) return;
    const { data, error } = await supabase
      .from("staple_items")
      .select("*")
      .eq("household_id", householdId)
      .order("sort_order")
      .order("created_at", { ascending: true });

    if (error) toast.error("定番品の取得に失敗しました");
    if (data) setStapleItems(data);
    setLoading(false);
  }, [householdId, supabase]);

  useEffect(() => {
    fetchStapleItems();
  }, [fetchStapleItems]);

  const addStapleItem = async (item: {
    name: string;
    category_id?: string | null;
    default_quantity?: number | null;
    default_unit?: string | null;
    note?: string | null;
    icon?: string | null;
    created_by?: string | null;
  }) => {
    if (!householdId) return;

    const sortOrder = stapleItems.length;
    const tempId = crypto.randomUUID();
    const now = new Date().toISOString();
    const optimisticItem: StapleItem = {
      id: tempId,
      household_id: householdId,
      name: item.name,
      category_id: item.category_id ?? null,
      default_quantity: item.default_quantity ?? null,
      default_unit: item.default_unit ?? null,
      note: item.note ?? null,
      icon: item.icon ?? null,
      sort_order: sortOrder,
      use_count: 0,
      last_used_at: null,
      created_by: item.created_by ?? null,
      created_at: now,
      updated_at: now,
    };
    setStapleItems((prev) => [...prev, optimisticItem]);

    const { data, error } = await supabase
      .from("staple_items")
      .insert({ id: tempId, ...item, household_id: householdId, sort_order: sortOrder })
      .select()
      .single();

    if (error) {
      setStapleItems((prev) => prev.filter((si) => si.id !== tempId));
      toast.error("定番品の追加に失敗しました");
    } else if (data) {
      setStapleItems((prev) => prev.map((si) => (si.id === tempId ? data : si)));
    }
    return { data, error };
  };

  const updateStapleItem = async (
    id: string,
    updates: Partial<
      Pick<StapleItem, "name" | "category_id" | "default_quantity" | "default_unit" | "note" | "icon" | "sort_order">
    >
  ) => {
    let snapshot = stapleItems;
    setStapleItems((prev) => {
      snapshot = prev;
      return prev.map((si) => (si.id === id ? { ...si, ...updates } : si));
    });

    const { error } = await supabase.from("staple_items").update(updates).eq("id", id);

    if (error) {
      setStapleItems(snapshot);
      toast.error("定番品の更新に失敗しました");
    }
    return { error };
  };

  const deleteStapleItem = async (id: string) => {
    const previousItems = stapleItems;
    setStapleItems((prev) => prev.filter((si) => si.id !== id));

    const { error } = await supabase.from("staple_items").delete().eq("id", id);

    if (error) {
      setStapleItems(previousItems);
      toast.error("定番品の削除に失敗しました");
    }
    return { error };
  };

  const reorderStapleItems = async (orderedIds: string[]) => {
    let snapshot = stapleItems;
    setStapleItems((prev) => {
      snapshot = prev;
      const idToItem = new Map(prev.map((si) => [si.id, si]));
      return orderedIds
        .map((id, i) => {
          const item = idToItem.get(id);
          if (!item) return null;
          return { ...item, sort_order: i };
        })
        .filter((item): item is StapleItem => item !== null);
    });

    const { error } = await supabase.rpc("reorder_staple_items", {
      p_item_ids: orderedIds,
      p_sort_orders: orderedIds.map((_, i) => i),
    });

    if (error) {
      setStapleItems(snapshot);
      toast.error("定番品の並び替えに失敗しました");
    }
  };

  const recordUsage = async (id: string) => {
    const item = stapleItems.find((si) => si.id === id);
    if (!item) return;

    const now = new Date().toISOString();
    const newCount = item.use_count + 1;

    setStapleItems((prev) =>
      prev.map((si) =>
        si.id === id ? { ...si, use_count: newCount, last_used_at: now } : si
      )
    );

    await supabase
      .from("staple_items")
      .update({ use_count: newCount, last_used_at: now })
      .eq("id", id);
  };

  return {
    stapleItems,
    setStapleItems,
    loading,
    addStapleItem,
    updateStapleItem,
    deleteStapleItem,
    reorderStapleItems,
    recordUsage,
    refetch: fetchStapleItems,
  };
}
