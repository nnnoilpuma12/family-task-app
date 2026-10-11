"use client";

import { useEffect, useCallback, useMemo } from "react";
import { type QueryFunctionContext, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import type { Category } from "@/types";

export function useCategories(householdId: string | null, managedResync = false) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  const fetchCategories = useCallback(async ({ signal }: QueryFunctionContext): Promise<Category[]> => {
    if (!householdId) return [];
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("household_id", householdId)
      .order("sort_order")
      .abortSignal(signal);

    if (error) throw error;
    return data ?? [];
  }, [householdId, supabase]);

  const query = useQuery({
    queryKey: queryKeys.categories(householdId),
    queryFn: fetchCategories,
    refetchOnWindowFocus: !managedResync,
    refetchOnReconnect: !managedResync,
    enabled: !!householdId,
  });

  const categories = useMemo(() => query.data ?? [], [query.data]);
  const loading = !householdId || query.isLoading;

  useEffect(() => {
    if (query.isError) toast.error("カテゴリの取得に失敗しました");
  }, [query.isError]);

  const setCategories = useCallback<React.Dispatch<React.SetStateAction<Category[]>>>(
    (update) => {
      queryClient.setQueryData<Category[]>(queryKeys.categories(householdId), (old) => {
        const prev = old ?? [];
        return typeof update === "function"
          ? (update as (p: Category[]) => Category[])(prev)
          : update;
      });
    },
    [queryClient, householdId]
  );

  const addCategory = async (name: string, color: string) => {
    if (!householdId) return;
    const sortOrder = categories.length;
    const { data, error } = await supabase
      .from("categories")
      .insert({ household_id: householdId, name, color, sort_order: sortOrder })
      .select()
      .single();

    if (error) toast.error("カテゴリの追加に失敗しました");
    if (!error && data) {
      setCategories((prev) => [...prev, data]);
    }
    return { data, error };
  };

  const updateCategory = async (id: string, updates: Partial<Pick<Category, "name" | "color" | "icon" | "sort_order">>) => {
    let previous: Category | undefined;
    setCategories((prev) => {
      previous = prev.find((category) => category.id === id);
      return prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
    });

    const { error } = await supabase
      .from("categories")
      .update(updates)
      .eq("id", id);

    if (error) {
      const before = previous;
      if (before) setCategories((prev) => prev.map((category) => {
        if (category.id !== id) return category;
        const restored = { ...category };
        for (const key of Object.keys(updates) as (keyof typeof updates)[]) {
          if (restored[key] === updates[key]) Object.assign(restored, { [key]: before[key] });
        }
        return restored;
      }));
      toast.error("カテゴリの更新に失敗しました");
    }
    return { error };
  };

  const deleteCategory = async (id: string) => {
    const fallback = categories.find((category) => category.id !== id);
    if (!fallback) {
      const error = new Error("最後のカテゴリは削除できません");
      toast.error("先に別のカテゴリを作成してください");
      return { error };
    }
    const { error } = await supabase.rpc("delete_category_with_fallback", {
      p_category_id: id,
      p_fallback_id: fallback.id,
    });

    if (error) toast.error("カテゴリの削除に失敗しました");
    if (!error) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
      queryClient.removeQueries({ queryKey: queryKeys.tasks(householdId), exact: true });
      queryClient.removeQueries({ queryKey: queryKeys.stapleItems(householdId), exact: true });
      queryClient.removeQueries({ queryKey: queryKeys.recommendations(householdId), exact: true });
      queryClient.removeQueries({ queryKey: queryKeys.titleSuggestions(householdId), exact: true });
    }
    return { error };
  };

  const reorderCategories = async (orderedIds: string[]) => {
    let snapshot = categories;
    setCategories((prev) => {
      snapshot = prev;
      const map = new Map(prev.map((c) => [c.id, c]));
      const reordered = orderedIds.flatMap((id, i) => {
        const category = map.get(id);
        return category ? [{ ...category, sort_order: i }] : [];
      });
      return [...reordered, ...prev.filter((category) => !orderedIds.includes(category.id))];
    });
    const { error } = await supabase.rpc("reorder_categories", {
      p_category_ids: orderedIds,
      p_sort_orders: orderedIds.map((_, index) => index),
    });
    if (error) {
      const previousOrder = new Map(snapshot.map((category, index) => [category.id, index]));
      const previousCategories = new Map(snapshot.map((category) => [category.id, category]));
      setCategories((prev) => [...prev].map((category) => {
        const old = previousCategories.get(category.id);
        const optimisticOrder = orderedIds.indexOf(category.id);
        return old && optimisticOrder >= 0 && category.sort_order === optimisticOrder
          ? { ...category, sort_order: old.sort_order } : category;
      }).sort((a, b) => (previousOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (previousOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER)));
      toast.error("カテゴリの並び替えに失敗しました");
    }
  };

  return { categories, setCategories, loading, addCategory, updateCategory, deleteCategory, reorderCategories, refetch: query.refetch };
}
