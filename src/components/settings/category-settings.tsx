"use client";

import { CategoryManager } from "@/components/category/category-manager";
import type { Category } from "@/types";

interface CategorySettingsProps {
  categories: Category[];
  onAdd: (name: string, color: string) => Promise<void>;
  onUpdate: (id: string, updates: { name?: string; color?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function CategorySettings({ categories, onAdd, onUpdate, onDelete }: CategorySettingsProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-900">カテゴリ管理</h3>
      <CategoryManager
        categories={categories}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </div>
  );
}
