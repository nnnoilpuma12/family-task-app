"use client";

import type { Category } from "@/types";

interface CategoryPickerProps {
  categories: Category[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
  showNone?: boolean;
  label?: string;
}

export function CategoryPicker({
  categories,
  selectedId,
  onChange,
  showNone = false,
  label,
}: CategoryPickerProps) {
  return (
    <div>
      {label && (
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">{label}</label>
      )}
      <div className="flex flex-wrap gap-1.5">
        {showNone && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              selectedId === null ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            なし
          </button>
        )}
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedId === cat.id ? "text-white" : "bg-gray-100 text-gray-600"
            }`}
            style={selectedId === cat.id ? { backgroundColor: cat.color } : undefined}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}
