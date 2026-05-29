"use client";

import { Pencil, Trash2, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/category/color-picker";
import type { Category } from "@/types";

interface SortableCategoryRowProps {
  cat: Category;
  editingId: string | null;
  name: string;
  color: string;
  onNameChange: (v: string) => void;
  onColorChange: (c: string) => void;
  onStartEdit: (cat: Category) => void;
  onUpdate: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
}

export function SortableCategoryRow({
  cat,
  editingId,
  name,
  color,
  onNameChange,
  onColorChange,
  onStartEdit,
  onUpdate,
  onCancelEdit,
  onDelete,
}: SortableCategoryRowProps) {
  const isEditing = editingId === cat.id;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cat.id, disabled: isEditing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      {isEditing ? (
        <div className="flex flex-1 flex-col gap-2">
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            maxLength={50}
            className="rounded border border-border-strong bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-focus focus:ring-2 focus:ring-focus/15"
            autoFocus
          />
          <ColorPicker value={color} onChange={onColorChange} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onUpdate(cat.id)}>保存</Button>
            <Button size="sm" variant="ghost" onClick={onCancelEdit}>キャンセル</Button>
          </div>
        </div>
      ) : (
        <>
          <button
            {...attributes}
            {...listeners}
            className="touch-none cursor-grab p-1 text-subtle hover:text-muted active:cursor-grabbing shrink-0"
            tabIndex={-1}
          >
            <GripVertical size={16} />
          </button>
          <div
            className="h-4 w-4 rounded-full shrink-0"
            style={{ backgroundColor: cat.color }}
          />
          <span className="flex-1 text-sm text-foreground">{cat.name}</span>
          <button onClick={() => onStartEdit(cat)} className="p-1 text-subtle hover:text-foreground">
            <Pencil size={16} />
          </button>
          <button onClick={() => onDelete(cat.id)} className="p-1 text-subtle hover:text-danger">
            <Trash2 size={16} />
          </button>
        </>
      )}
    </div>
  );
}

export function CategoryRowOverlay({ cat }: { cat: Category }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface px-2 py-1 shadow-md opacity-90 border border-border">
      <GripVertical size={16} className="text-subtle shrink-0" />
      <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
      <span className="flex-1 text-sm text-foreground">{cat.name}</span>
    </div>
  );
}
