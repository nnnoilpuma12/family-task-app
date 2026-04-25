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
        <label className="text-xs font-medium text-muted mb-1.5 block">{label}</label>
      )}
      <div className="flex flex-wrap gap-1.5">
        {showNone && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              selectedId === null ? "bg-foreground text-white" : "bg-surface-strong text-muted"
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
              selectedId === cat.id ? "text-white" : "bg-surface-strong text-muted"
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
