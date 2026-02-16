"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/types";

export function useCategories(householdId: string | null) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    if (!householdId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("household_id", householdId)
      .order("sort_order");

    if (data) setCategories(data);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const addCategory = async (name: string, color: string) => {
    if (!householdId) return;
    const supabase = createClient();
    const sortOrder = categories.length;
    const { data, error } = await supabase
      .from("categories")
      .insert({ household_id: householdId, name, color, sort_order: sortOrder })
      .select()
      .single();

    if (!error && data) {
      setCategories((prev) => [...prev, data]);
    }
    return { data, error };
  };

  const updateCategory = async (id: string, updates: Partial<Pick<Category, "name" | "color" | "icon" | "sort_order">>) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("categories")
      .update(updates)
      .eq("id", id);

    if (!error) {
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      );
    }
    return { error };
  };

  const deleteCategory = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("categories").delete().eq("id", id);

    if (!error) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    }
    return { error };
  };

  return { categories, loading, addCategory, updateCategory, deleteCategory, refetch: fetchCategories };
}
