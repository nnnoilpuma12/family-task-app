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
  const todayDate = getQuickDate(0);
  const tomorrowDate = getQuickDate(1);
  const isTodaySelected = value === todayDate;
  const isTomorrowSelected = value === tomorrowDate;

  return (
    <div>
      {label && (
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">{label}</label>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(todayDate)}
          aria-pressed={isTodaySelected}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            isTodaySelected
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          今日
        </button>
        <button
          type="button"
          onClick={() => onChange(tomorrowDate)}
          aria-pressed={isTomorrowSelected}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            isTomorrowSelected
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
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
