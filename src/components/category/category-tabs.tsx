"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { Category } from "@/types";

interface CategoryTabsProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function CategoryTabs({ categories, selectedId, onSelect }: CategoryTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active tab when selectedId changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeBtn = container.querySelector("[data-active]") as HTMLElement | null;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [selectedId]);

  return (
    <div ref={containerRef} className="flex gap-1 overflow-x-auto px-4 py-2 no-scrollbar">
      <button
        onClick={() => onSelect(null)}
        className="relative shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
        {...(selectedId === null ? { "data-active": true } : {})}
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
          {...(selectedId === cat.id ? { "data-active": true } : {})}
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
