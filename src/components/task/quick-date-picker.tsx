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
        <label className="text-xs font-medium text-muted mb-1.5 block">{label}</label>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(todayDate)}
          aria-pressed={isTodaySelected}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            isTodaySelected
              ? "bg-primary text-white"
              : "bg-surface-strong text-muted hover:bg-border-strong"
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
              ? "bg-primary text-white"
              : "bg-surface-strong text-muted hover:bg-border-strong"
          }`}
        >
          明日
        </button>
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded border border-border-strong bg-surface px-3 py-1 text-sm text-foreground outline-none focus:border-focus focus:ring-2 focus:ring-focus/15"
        />
        {showClear && value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-subtle hover:text-foreground"
          >
            クリア
          </button>
        )}
      </div>
    </div>
  );
}
