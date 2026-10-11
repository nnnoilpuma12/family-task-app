"use client";

import { useEffect, useCallback, useMemo } from "react";
import { type QueryFunctionContext, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { useIdleReady } from "@/hooks/use-idle-ready";
import type { StapleItem } from "@/types";

export function useStapleItems(householdId: string | null, managedResync = false) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  const fetchStapleItems = useCallback(async ({ signal }: QueryFunctionContext): Promise<StapleItem[]> => {
    if (!householdId) return [];
    const { data, error } = await supabase
      .from("staple_items")
      .select("*")
      .eq("household_id", householdId)
      .order("sort_order")
      .order("created_at", { ascending: true })
      .abortSignal(signal);

    if (error) throw error;
    return data ?? [];
  }, [householdId, supabase]);

  // 定番品は「定番品シート」を開くまで描画に使われない。起動時の取得競合を減らすため、
  // 初回ペイント後（アイドル）まで発火を遅らせる。シートを開くのは必ずユーザー操作で、
  // アイドルはその前に来るため、体感上の待ちは増えない。
  const { isReady } = useIdleReady(!!householdId);

  const query = useQuery({
    queryKey: queryKeys.stapleItems(householdId),
    queryFn: fetchStapleItems,
    refetchOnWindowFocus: !managedResync,
    refetchOnReconnect: !managedResync,
    enabled: !!householdId && isReady,
  });

  const stapleItems = useMemo(() => query.data ?? [], [query.data]);
  // isLoading は「無効化中（enabled: false）」だと false になるため、アイドル待ちの
  // あいだ「0 件で読み込み完了」に見えてしまう。pending で見るのが正しい。
  const loading = !householdId || query.isPending;

  useEffect(() => {
    if (query.isError) toast.error("定番品の取得に失敗しました");
  }, [query.isError]);

  const setStapleItems = useCallback<React.Dispatch<React.SetStateAction<StapleItem[]>>>(
    (update) => {
      queryClient.setQueryData<StapleItem[]>(queryKeys.stapleItems(householdId), (old) => {
        const prev = old ?? [];
        return typeof update === "function"
          ? (update as (p: StapleItem[]) => StapleItem[])(prev)
          : update;
      });
    },
    [queryClient, householdId]
  );

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
    let previous: StapleItem | undefined;
    setStapleItems((prev) => {
      previous = prev.find((item) => item.id === id);
      return prev.map((si) => (si.id === id ? { ...si, ...updates } : si));
    });

    const { error } = await supabase.from("staple_items").update(updates).eq("id", id);

    if (error) {
      const before = previous;
      if (before) setStapleItems((prev) => prev.map((item) => {
        if (item.id !== id) return item;
        const restored = { ...item };
        for (const key of Object.keys(updates) as (keyof typeof updates)[]) {
          if (restored[key] === updates[key]) Object.assign(restored, { [key]: before[key] });
        }
        return restored;
      }));
      toast.error("定番品の更新に失敗しました");
    }
    return { error };
  };

  const deleteStapleItem = async (id: string) => {
    const previousItems = queryClient.getQueryData<StapleItem[]>(queryKeys.stapleItems(householdId)) ?? stapleItems;
    const deletedItem = previousItems.find((item) => item.id === id);
    const previousIndex = previousItems.findIndex((item) => item.id === id);
    setStapleItems((prev) => prev.filter((si) => si.id !== id));

    const { error } = await supabase.from("staple_items").delete().eq("id", id);

    if (error) {
      if (deletedItem) setStapleItems((prev) => {
        if (prev.some((item) => item.id === id)) return prev;
        const next = [...prev];
        next.splice(Math.min(previousIndex, next.length), 0, deletedItem);
        return next;
      });
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
      const previousOrder = new Map(snapshot.map((item, index) => [item.id, index]));
      const previousItems = new Map(snapshot.map((item) => [item.id, item]));
      setStapleItems((prev) => [...prev].map((item) => {
        const old = previousItems.get(item.id);
        const optimisticOrder = orderedIds.indexOf(item.id);
        return old && optimisticOrder >= 0 && item.sort_order === optimisticOrder
          ? { ...item, sort_order: old.sort_order } : item;
      }).sort((a, b) => (previousOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (previousOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER)));
      toast.error("定番品の並び替えに失敗しました");
    }
  };

  const recordUsage = async (id: string) => {
    const item = queryClient.getQueryData<StapleItem[]>(queryKeys.stapleItems(householdId))?.find((si) => si.id === id);
    if (!item) return;

    const now = new Date().toISOString();
    setStapleItems((prev) =>
      prev.map((si) =>
        si.id === id ? { ...si, use_count: si.use_count + 1, last_used_at: now } : si
      )
    );

    const { data, error } = await supabase.rpc("record_staple_usage", { p_item_id: id });
    if (error) {
      setStapleItems((prev) => prev.map((si) => si.id === id
        ? { ...si, use_count: Math.max(0, si.use_count - 1), last_used_at: si.last_used_at === now ? item.last_used_at : si.last_used_at }
        : si));
      toast.error("使用回数の更新に失敗しました");
      return;
    }
    const saved = data?.[0];
    if (saved) setStapleItems((prev) => prev.map((si) => si.id === id
      ? { ...si, use_count: Math.max(si.use_count, saved.use_count), last_used_at: saved.last_used_at }
      : si));
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
    refetch: query.refetch,
  };
}
