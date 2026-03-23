"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  getSuggestions?: (query: string) => string[];
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
  getSuggestions,
  onSubmit,
}: TaskCreateSheetProps) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(selectedCategoryId);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCategoryId(selectedCategoryId);
    }
  }, [isOpen, selectedCategoryId]);
  const [dueDate, setDueDate] = useState<string>("");
  const [memo, setMemo] = useState("");

  // タイトル変更時にサジェスト候補を算出
  const suggestions = useMemo(() => {
    if (!getSuggestions || !title.trim()) return [];
    const results = getSuggestions(title);
    // 完全一致のみの場合はサジェストを表示しない
    if (results.length === 1 && results[0].toLowerCase() === title.trim().toLowerCase()) {
      return [];
    }
    return results;
  }, [title, getSuggestions]);

  const handleSelectSuggestion = (suggestion: string) => {
    setTitle(suggestion);
    setSuggestionDismissed(true);
    inputRef.current?.focus();
  };

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
        <div className="relative">
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSuggestionDismissed(false);
            }}
            placeholder="タスク名を入力"
            maxLength={255}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base outline-none focus:border-indigo-500"
            autoFocus
            autoComplete="off"
          />

          {!suggestionDismissed && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-800 hover:bg-indigo-50 active:bg-indigo-100"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectSuggestion(s)}
                  >
                    <SuggestionHighlight text={s} query={title} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

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

/** マッチ部分をハイライト表示するコンポーネント */
function SuggestionHighlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  if (!q) return <>{text}</>;

  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-indigo-600">{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  );
}
