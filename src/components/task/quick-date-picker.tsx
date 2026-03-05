"use client";

import { getQuickDate } from "@/lib/date";

interface QuickDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  showClear?: boolean;
  label?: string;
}

export function QuickDatePicker({
  value,
  onChange,
  showClear = false,
  label,
}: QuickDatePickerProps) {
  return (
    <div>
      {label && (
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">{label}</label>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(getQuickDate(0))}
          className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
        >
          今日
        </button>
        <button
          type="button"
          onClick={() => onChange(getQuickDate(1))}
          className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
        >
          明日
        </button>
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-1 text-sm outline-none focus:border-indigo-500"
        />
        {showClear && value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            クリア
          </button>
        )}
      </div>
    </div>
  );
}
