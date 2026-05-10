"use client";

import { useState, useEffect } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { CategoryPicker } from "@/components/task/category-picker";
import type { Category, StapleItem } from "@/types";

const UNIT_OPTIONS = ["個", "本", "枚", "袋", "箱", "パック", "缶", "瓶", "束", "玉", "g", "kg", "ml", "L"];

const ICON_PRESETS = [
  "🛒", "🥛", "🥚", "🍞", "🧈", "🧀", "🍖", "🍗", "🐟", "🦐",
  "🥦", "🥕", "🍅", "🧅", "🧄", "🍋", "🍎", "🍌", "🍜", "🍣",
  "🍙", "🥞", "🧃", "🍵", "☕", "🧴", "🧻", "🪥", "🧺", "🧹",
];

interface StapleItemFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  item?: StapleItem | null;
  defaultCategoryId?: string | null;
  onSubmit: (data: {
    name: string;
    category_id: string | null;
    default_quantity: number | null;
    default_unit: string | null;
    note: string | null;
    icon: string | null;
  }) => void;
}

export function StapleItemFormSheet({
  isOpen,
  onClose,
  categories,
  item,
  defaultCategoryId,
  onSubmit,
}: StapleItemFormSheetProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [quantityStr, setQuantityStr] = useState("");
  const [unit, setUnit] = useState("");
  const [note, setNote] = useState("");
  const [showIconPicker, setShowIconPicker] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setName(item.name);
        setIcon(item.icon ?? "");
        setCategoryId(item.category_id);
        setQuantityStr(item.default_quantity !== null ? String(item.default_quantity) : "");
        setUnit(item.default_unit ?? "");
        setNote(item.note ?? "");
      } else {
        setName("");
        setIcon("");
        setCategoryId(defaultCategoryId ?? null);
        setQuantityStr("");
        setUnit("");
        setNote("");
      }
      setShowIconPicker(false);
    }
  }, [isOpen, item, defaultCategoryId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const quantity = quantityStr ? parseFloat(quantityStr) : null;

    onSubmit({
      name: name.trim(),
      category_id: categoryId,
      default_quantity: quantity !== null && !isNaN(quantity) ? quantity : null,
      default_unit: unit.trim() || null,
      note: note.trim() || null,
      icon: icon || null,
    });

    onClose();
  };

  const title = item ? "定番品を編集" : "定番品を追加";

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title} elevated>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* アイコン + 名前 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowIconPicker((v) => !v)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-2xl"
            aria-label="アイコンを選択"
          >
            {icon || "🛒"}
          </button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="定番品の名前"
            maxLength={255}
            autoFocus
            autoComplete="off"
            className="flex-1 rounded border border-border-strong bg-surface px-4 py-3 text-base text-foreground placeholder:text-subtle outline-none focus:border-focus focus:ring-2 focus:ring-focus/15"
          />
        </div>

        {showIconPicker && (
          <div className="grid grid-cols-8 gap-2 rounded-xl border border-border bg-surface-strong p-3">
            {ICON_PRESETS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setIcon(emoji);
                  setShowIconPicker(false);
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-xl transition-colors ${icon === emoji ? "bg-primary/20" : "hover:bg-surface active:bg-border"}`}
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setIcon("");
                setShowIconPicker(false);
              }}
              className="col-span-2 rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface active:bg-border"
            >
              リセット
            </button>
          </div>
        )}

        <CategoryPicker
          categories={categories}
          selectedId={categoryId}
          onChange={setCategoryId}
        />

        {/* 数量・単位 */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <input
              type="number"
              inputMode="decimal"
              value={quantityStr}
              onChange={(e) => setQuantityStr(e.target.value)}
              placeholder="数量（任意）"
              min="0"
              step="0.5"
              className="w-full rounded border border-border-strong bg-surface px-4 py-3 text-sm text-foreground placeholder:text-subtle outline-none focus:border-focus focus:ring-2 focus:ring-focus/15"
            />
          </div>
          <div className="w-28">
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded border border-border-strong bg-surface px-3 py-3 text-sm text-foreground outline-none focus:border-focus focus:ring-2 focus:ring-focus/15"
            >
              <option value="">単位なし</option>
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="メモ（銘柄・サイズなど、任意）"
          maxLength={1000}
          rows={2}
          className="rounded border border-border-strong bg-surface px-4 py-3 text-sm text-foreground placeholder:text-subtle outline-none resize-none focus:border-focus focus:ring-2 focus:ring-focus/15"
        />

        <Button type="submit" disabled={!name.trim()}>
          {item ? "保存" : "追加"}
        </Button>
      </form>
    </BottomSheet>
  );
}
