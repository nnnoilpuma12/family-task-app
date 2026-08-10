"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ExternalLink, Trash2 } from "lucide-react";
import type { Task, Category, Profile } from "@/types";
import { isValidUrl } from "@/lib/validation";
import { CategoryPicker } from "@/components/task/category-picker";
import { QuickDatePicker } from "@/components/task/quick-date-picker";

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  members: Profile[];
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

export function TaskDetailModal({
  task,
  isOpen,
  onClose,
  categories,
  members,
  onUpdate,
  onDelete,
}: TaskDetailModalProps) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [memo, setMemo] = useState("");
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");

  // 開いたタスクが変わったらフォームを同期する。
  // effect ではなく render 中に前回値と比較して調整する（React 公式の
  // 「props 変更に応じた state 調整」パターン）。閉じると task が null になり
  // syncedTaskId も null に戻るため、同じタスクを開き直せば再同期される。
  const [syncedTaskId, setSyncedTaskId] = useState<string | null>(null);
  if ((task?.id ?? null) !== syncedTaskId) {
    setSyncedTaskId(task?.id ?? null);
    if (task) {
      setTitle(task.title);
      setCategoryId(task.category_id);
      setDueDate(task.due_date ?? "");
      setMemo(task.memo ?? "");
      setUrl(task.url ?? "");
      setUrlError("");
    }
  }

  if (!task) return null;

  const handleSave = () => {
    if (!title.trim()) return;
    if (url && !isValidUrl(url)) {
      setUrlError("URLはhttpまたはhttpsで始まる必要があります");
      return;
    }
    setUrlError("");
    onUpdate(task.id, {
      title: title.trim(),
      category_id: categoryId,
      due_date: dueDate || null,
      memo: memo || null,
      url: url || null,
    });
    onClose();
  };

  const handleDelete = () => {
    onDelete(task.id);
    onClose();
  };

  const createdByMember = members.find((m) => m.id === task.created_by);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="タスク詳細">
      <div className="flex flex-col gap-4">
        {/* Title */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={255}
          className="rounded border border-border-strong bg-surface px-4 py-3 text-base font-medium text-foreground outline-none focus:border-focus focus:ring-2 focus:ring-focus/15"
        />

        {/* Category */}
        <CategoryPicker
          categories={categories}
          selectedId={categoryId}
          onChange={setCategoryId}
          label="カテゴリ"
        />

        {/* Due date */}
        <QuickDatePicker
          value={dueDate}
          onChange={setDueDate}
          showClear
          label="期限"
        />

        {/* Memo */}
        <div>
          <label className="text-xs font-medium text-muted mb-1.5 block">メモ</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="メモを入力..."
            maxLength={5000}
            rows={3}
            className="w-full rounded border border-border-strong bg-surface px-4 py-3 text-sm text-foreground placeholder:text-subtle outline-none resize-none focus:border-focus focus:ring-2 focus:ring-focus/15"
          />
        </div>

        {/* URL */}
        <div>
          <label className="text-xs font-medium text-muted mb-1.5 block">URL</label>
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError(""); }}
              placeholder="https://..."
              className={`flex-1 rounded border bg-surface px-4 py-2 text-sm text-foreground placeholder:text-subtle outline-none focus:border-focus focus:ring-2 focus:ring-focus/15 ${urlError ? "border-danger" : "border-border-strong"}`}
            />
            {url && !urlError && isValidUrl(url) && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center rounded bg-surface-strong px-3 text-muted hover:bg-border-strong"
              >
                <ExternalLink size={16} />
              </a>
            )}
          </div>
          {urlError && (
            <p className="mt-1 text-xs text-danger">{urlError}</p>
          )}
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-2 text-xs text-subtle border-t border-border pt-3">
          {createdByMember && (
            <span>作成: {createdByMember.nickname || "不明"}</span>
          )}
          <span>{new Date(task.created_at).toLocaleDateString("ja-JP")}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={!title.trim()} className="flex-1">
            保存
          </Button>
          <Button variant="danger" onClick={handleDelete} className="shrink-0">
            <Trash2 size={18} />
          </Button>
        </div>
      </div>
    </Modal>
  );
}
