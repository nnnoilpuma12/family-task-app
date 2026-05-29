"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { ColorPicker, PRESET_COLORS } from "@/components/category/color-picker";
import { SortableCategoryRow, CategoryRowOverlay } from "@/components/category/sortable-category-row";
import type { Category } from "@/types";

interface CategoryManagerProps {
  categories: Category[];
  onAdd: (name: string, color: string) => Promise<void>;
  onUpdate: (id: string, updates: { name?: string; color?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (orderedIds: string[]) => Promise<void>;
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
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border-strong p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="カテゴリ名"
            maxLength={50}
            className="rounded border border-border-strong bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-focus focus:ring-2 focus:ring-focus/15"
            autoFocus
          />
          <ColorPicker value={color} onChange={setColor} />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd}>追加</Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setName(""); }}>キャンセル</Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setIsAdding(true); setEditingId(null); }}
          className="flex items-center gap-2 rounded-lg border border-dashed border-border-strong p-3 text-sm text-muted hover:border-foreground hover:text-foreground"
        >
          <Plus size={16} />
          カテゴリを追加
        </button>
      )}
    </div>
  );
}
