"use client";

import { useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import type { Category } from "@/types";

export function useCategories(householdId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  const fetchCategories = useCallback(async (): Promise<Category[]> => {
    if (!householdId) return [];
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("household_id", householdId)
      .order("sort_order");

    if (error) throw error;
    return data ?? [];
  }, [householdId, supabase]);

  const query = useQuery({
    queryKey: queryKeys.categories(householdId),
    queryFn: fetchCategories,
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
    const { error } = await supabase
      .from("categories")
      .update(updates)
      .eq("id", id);

    if (error) toast.error("カテゴリの更新に失敗しました");
    if (!error) {
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      );
    }
    return { error };
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);

    if (error) toast.error("カテゴリの削除に失敗しました");
    if (!error) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    }
    return { error };
  };

  const reorderCategories = async (orderedIds: string[]) => {
    setCategories((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]));
      return orderedIds.map((id, i) => ({ ...map.get(id)!, sort_order: i }));
    });
    const results = await Promise.all(
      orderedIds.map((id, i) =>
        supabase.from("categories").update({ sort_order: i }).eq("id", id)
      )
    );
    if (results.some((r) => r.error)) {
      toast.error("カテゴリの並び替えに失敗しました");
      query.refetch();
    }
  };

  return { categories, loading, addCategory, updateCategory, deleteCategory, reorderCategories, refetch: query.refetch };
}
