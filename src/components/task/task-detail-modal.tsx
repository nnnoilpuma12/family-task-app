"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ExternalLink, Trash2 } from "lucide-react";
import type { Task, Category, Profile } from "@/types";

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  members: Profile[];
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
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

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setCategoryId(task.category_id);
      setDueDate(task.due_date ?? "");
      setMemo(task.memo ?? "");
      setUrl(task.url ?? "");
    }
  }, [task]);

  if (!task) return null;

  const handleSave = async () => {
    if (url && !isValidUrl(url)) {
      setUrlError("URLはhttpまたはhttpsで始まる必要があります");
      return;
    }
    setUrlError("");
    await onUpdate(task.id, {
      title: title.trim(),
      category_id: categoryId,
      due_date: dueDate || null,
      memo: memo || null,
      url: url || null,
    });
    onClose();
  };

  const handleDelete = async () => {
    await onDelete(task.id);
    onClose();
  };

  const setQuickDate = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    setDueDate(d.toISOString().split("T")[0]);
  };

  const createdByMember = members.find((m) => m.id === task.created_by);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="タスク詳細">
      <div className="flex flex-col gap-4">
        {/* Title */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-3 text-base font-medium outline-none focus:border-indigo-500"
        />

        {/* Category */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">カテゴリ</label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryId(null)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                categoryId === null ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              なし
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryId(cat.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  categoryId === cat.id ? "text-white" : "bg-gray-100 text-gray-600"
                }`}
                style={categoryId === cat.id ? { backgroundColor: cat.color } : undefined}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Due date */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">期限</label>
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
            {dueDate && (
              <button
                type="button"
                onClick={() => setDueDate("")}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                クリア
              </button>
            )}
          </div>
        </div>

        {/* Memo */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">メモ</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="メモを入力..."
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none resize-none focus:border-indigo-500"
          />
        </div>

        {/* URL */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">URL</label>
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError(""); }}
              placeholder="https://..."
              className={`flex-1 rounded-lg border px-4 py-2 text-sm outline-none focus:border-indigo-500 ${urlError ? "border-red-400" : "border-gray-300"}`}
            />
            {url && !urlError && isValidUrl(url) && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center rounded-lg bg-gray-100 px-3 text-gray-600 hover:bg-gray-200"
              >
                <ExternalLink size={16} />
              </a>
            )}
          </div>
          {urlError && (
            <p className="mt-1 text-xs text-red-500">{urlError}</p>
          )}
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-2 text-xs text-gray-400 border-t border-gray-100 pt-3">
          {createdByMember && (
            <span>作成: {createdByMember.nickname || "不明"}</span>
          )}
          <span>{new Date(task.created_at).toLocaleDateString("ja-JP")}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleSave} className="flex-1">
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
