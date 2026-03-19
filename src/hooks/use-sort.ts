import { useState } from "react";

export type SortOption = "manual" | "created_desc" | "created_asc" | "due_date";

const STORAGE_KEY = "task-sort-option";
const VALID_OPTIONS: SortOption[] = ["manual", "created_desc", "created_asc", "due_date"];

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "manual", label: "手動（並び替え可）" },
  { value: "created_desc", label: "追加順（新しい順）" },
  { value: "created_asc", label: "追加順（古い順）" },
  { value: "due_date", label: "期日順" },
];

export function useSort() {
  const [sortOption, setSortOptionState] = useState<SortOption>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && VALID_OPTIONS.includes(stored as SortOption)) {
        return stored as SortOption;
      }
    } catch {
      // localStorage not available
    }
    return "manual";
  });

  const setSortOption = (option: SortOption) => {
    setSortOptionState(option);
    try {
      localStorage.setItem(STORAGE_KEY, option);
    } catch {
      // localStorage not available
    }
  };

  return { sortOption, setSortOption };
}
