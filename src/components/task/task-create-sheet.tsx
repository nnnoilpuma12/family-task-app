"use client";

import { useState, useEffect } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { CategoryPicker } from "@/components/task/category-picker";
import { QuickDatePicker } from "@/components/task/quick-date-picker";
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

        <CategoryPicker
          categories={categories}
          selectedId={categoryId}
          onChange={setCategoryId}
        />

        <QuickDatePicker value={dueDate} onChange={setDueDate} />

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
