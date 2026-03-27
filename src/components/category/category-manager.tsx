"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus, GripVertical } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import type { Category } from "@/types";

interface CategoryManagerProps {
  categories: Category[];
  onAdd: (name: string, color: string) => Promise<void>;
  onUpdate: (id: string, updates: { name?: string; color?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (orderedIds: string[]) => Promise<void>;
}

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#6366f1", "#a855f7", "#ec4899",
];

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

function SortableCategoryRow({
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
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            autoFocus
          />
          <div className="flex gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onColorChange(c)}
                className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-gray-800" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
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
            className="touch-none cursor-grab p-1 text-gray-300 hover:text-gray-500 active:cursor-grabbing shrink-0"
            tabIndex={-1}
          >
            <GripVertical size={16} />
          </button>
          <div
            className="h-4 w-4 rounded-full shrink-0"
            style={{ backgroundColor: cat.color }}
          />
          <span className="flex-1 text-sm text-gray-900">{cat.name}</span>
          <button onClick={() => onStartEdit(cat)} className="p-1 text-gray-400 hover:text-gray-600">
            <Pencil size={16} />
          </button>
          <button onClick={() => onDelete(cat.id)} className="p-1 text-gray-400 hover:text-red-600">
            <Trash2 size={16} />
          </button>
        </>
      )}
    </div>
  );
}

function CategoryRowOverlay({ cat }: { cat: Category }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white px-2 py-1 shadow-lg opacity-90 border border-gray-100">
      <GripVertical size={16} className="text-gray-400 shrink-0" />
      <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
      <span className="flex-1 text-sm text-gray-900">{cat.name}</span>
    </div>
  );
}

export function CategoryManager({ categories, onAdd, onUpdate, onDelete, onReorder }: CategoryManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex);
    await onReorder(reordered.map((c) => c.id));
  };

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

  const activeCategory = activeId ? categories.find((c) => c.id === activeId) : null;

  return (
    <div className="flex flex-col gap-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {categories.map((cat) => (
            <SortableCategoryRow
              key={cat.id}
              cat={cat}
              editingId={editingId}
              name={name}
              color={color}
              onNameChange={setName}
              onColorChange={setColor}
              onStartEdit={startEdit}
              onUpdate={handleUpdate}
              onCancelEdit={() => setEditingId(null)}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>
        <DragOverlay>
          {activeCategory ? <CategoryRowOverlay cat={activeCategory} /> : null}
        </DragOverlay>
      </DndContext>

      {isAdding ? (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-gray-300 p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="カテゴリ名"
            maxLength={50}
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
