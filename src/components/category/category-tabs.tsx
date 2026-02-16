"use client";

import { motion } from "framer-motion";
import type { Category } from "@/types";

interface CategoryTabsProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function CategoryTabs({ categories, selectedId, onSelect }: CategoryTabsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto px-4 py-2 no-scrollbar">
      <button
        onClick={() => onSelect(null)}
        className="relative shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
      >
        {selectedId === null && (
          <motion.div
            layoutId="category-tab"
            className="absolute inset-0 rounded-full bg-indigo-100"
            transition={{ type: "spring", duration: 0.4 }}
          />
        )}
        <span className={`relative z-10 ${selectedId === null ? "text-indigo-700" : "text-gray-600"}`}>
          すべて
        </span>
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className="relative shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
        >
          {selectedId === cat.id && (
            <motion.div
              layoutId="category-tab"
              className="absolute inset-0 rounded-full"
              style={{ backgroundColor: `${cat.color}20` }}
              transition={{ type: "spring", duration: 0.4 }}
            />
          )}
          <span
            className="relative z-10"
            style={{ color: selectedId === cat.id ? cat.color : "#6b7280" }}
          >
            {cat.name}
          </span>
        </button>
      ))}
    </div>
  );
}
