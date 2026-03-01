"use client";

import { useState, useEffect } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import type { Category } from "@/types";

interface TaskCreateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  selectedCategoryId: string | null;
  onSubmit: (task: {
    title: string;
    category_id?: string | null;
    due_date?: string | null;
    memo?: string | null;
  }) => void;
}

export function TaskCreateSheet({
  isOpen,
  onClose,
  categories,
  selectedCategoryId,
  onSubmit,
}: TaskCreateSheetProps) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(selectedCategoryId);

  useEffect(() => {
    if (isOpen) {
      setCategoryId(selectedCategoryId);
    }
  }, [isOpen, selectedCategoryId]);
  const [dueDate, setDueDate] = useState<string>("");
  const [memo, setMemo] = useState("");
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      title: title.trim(),
      category_id: categoryId,
      due_date: dueDate || null,
      memo: memo || null,
    });

    setTitle("");
    setDueDate("");
    setMemo("");
    onClose();
  };

  const setQuickDate = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    setDueDate(d.toISOString().split("T")[0]);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="タスクを追加">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="タスク名を入力"
          maxLength={255}
          className="rounded-lg border border-gray-300 px-4 py-3 text-base outline-none focus:border-indigo-500"
          autoFocus
        />

        {/* Category selector */}
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryId(categoryId === cat.id ? null : cat.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                categoryId === cat.id
                  ? "text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
              style={
                categoryId === cat.id
                  ? { backgroundColor: cat.color }
                  : undefined
              }
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Due date */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setQuickDate(0)}
              className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
            >
              今日
            </button>
            <button
              type="button"
              onClick={() => setQuickDate(1)}
              className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
            >
              明日
            </button>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-1 text-sm outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Memo */}
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="メモ（任意）"
          maxLength={5000}
          rows={2}
          className="rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none resize-none focus:border-indigo-500"
        />

        <Button type="submit" disabled={!title.trim()}>
          追加
        </Button>
      </form>
    </BottomSheet>
  );
}
