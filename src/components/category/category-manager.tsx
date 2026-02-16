"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Category } from "@/types";

interface CategoryManagerProps {
  categories: Category[];
  onAdd: (name: string, color: string) => Promise<void>;
  onUpdate: (id: string, updates: { name?: string; color?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#6366f1", "#a855f7", "#ec4899",
];

export function CategoryManager({ categories, onAdd, onUpdate, onDelete }: CategoryManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    await onAdd(name.trim(), color);
    setName("");
    setColor(PRESET_COLORS[0]);
    setIsAdding(false);
  };

  const handleUpdate = async (id: string) => {
    if (!name.trim()) return;
    await onUpdate(id, { name: name.trim(), color });
    setEditingId(null);
    setName("");
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setColor(cat.color);
    setIsAdding(false);
  };

  return (
    <div className="flex flex-col gap-3">
      {categories.map((cat) => (
        <div key={cat.id} className="flex items-center gap-3">
          {editingId === cat.id ? (
            <div className="flex flex-1 flex-col gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                autoFocus
              />
              <div className="flex gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-gray-800" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleUpdate(cat.id)}>保存</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>キャンセル</Button>
              </div>
            </div>
          ) : (
            <>
              <div
                className="h-4 w-4 rounded-full shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span className="flex-1 text-sm text-gray-900">{cat.name}</span>
              <button onClick={() => startEdit(cat)} className="p-1 text-gray-400 hover:text-gray-600">
                <Pencil size={16} />
              </button>
              <button onClick={() => onDelete(cat.id)} className="p-1 text-gray-400 hover:text-red-600">
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      ))}

      {isAdding ? (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-gray-300 p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="カテゴリ名"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            autoFocus
          />
          <div className="flex gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-gray-800" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd}>追加</Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setName(""); }}>キャンセル</Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setIsAdding(true); setEditingId(null); }}
          className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700"
        >
          <Plus size={16} />
          カテゴリを追加
        </button>
      )}
    </div>
  );
}
