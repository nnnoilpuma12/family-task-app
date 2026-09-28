"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { StapleItem } from "@/types";

interface StapleQuickAddSheetProps {
  isOpen: boolean;
  item: StapleItem | null;
  onClose: () => void;
  onConfirm: (item: StapleItem, overrideQuantity: number | null, overrideNote: string | null) => void;
}

export function StapleQuickAddSheet({ isOpen, item, onClose, onConfirm }: StapleQuickAddSheetProps) {
  const [quantityStr, setQuantityStr] = useState(
    () => item?.default_quantity !== null && item?.default_quantity !== undefined
      ? String(item.default_quantity)
      : ""
  );
  const [note, setNote] = useState(() => item?.note ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    const quantity = quantityStr ? parseFloat(quantityStr) : null;
    onConfirm(item, quantity !== null && !isNaN(quantity) ? quantity : null, note.trim() || null);
    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={item?.name ?? ""}
      elevated
    >
      <form key={`${item?.id ?? "empty"}-${isOpen ? "open" : "closed"}`} onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-muted">数量・メモを調整してリストに追加できます</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={quantityStr}
            onChange={(e) => setQuantityStr(e.target.value)}
            placeholder="数量"
            min="0"
            step="0.5"
            className="flex-1 rounded border border-border-strong bg-surface px-4 py-3 text-sm text-foreground placeholder:text-subtle outline-none focus:border-focus focus:ring-2 focus:ring-focus/15"
          />
          {item?.default_unit && (
            <span className="text-sm text-muted">{item.default_unit}</span>
          )}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="メモ（任意）"
          rows={2}
          maxLength={1000}
          className="rounded border border-border-strong bg-surface px-4 py-3 text-sm text-foreground placeholder:text-subtle outline-none resize-none focus:border-focus focus:ring-2 focus:ring-focus/15"
        />
        <button
          type="submit"
          className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white active:bg-primary/90"
        >
          リストに追加
        </button>
      </form>
    </BottomSheet>
  );
}
