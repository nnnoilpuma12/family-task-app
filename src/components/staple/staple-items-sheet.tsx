"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, ShoppingBag } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { StapleItemCard } from "@/components/staple/staple-item-card";
import { StapleItemFormSheet } from "@/components/staple/staple-item-form-sheet";
import type { StapleItem, Category } from "@/types";

interface SortableStapleCardProps {
  item: StapleItem;
  categories: Category[];
  isEditMode: boolean;
  onAddToTask: (item: StapleItem) => void;
  onLongPress: (item: StapleItem) => void;
  onDelete: (id: string) => void;
}

function SortableStapleCard(props: SortableStapleCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id,
    disabled: !props.isEditMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...(props.isEditMode ? { ...attributes, ...listeners } : {})}>
      <StapleItemCard {...props} isDragging={isDragging} />
    </div>
  );
}

interface QuickAddSheetProps {
  isOpen: boolean;
  item: StapleItem | null;
  onClose: () => void;
  onConfirm: (item: StapleItem, overrideQuantity: number | null, overrideNote: string | null) => void;
}

function QuickAddSheet({ isOpen, item, onClose, onConfirm }: QuickAddSheetProps) {
  const [quantityStr, setQuantityStr] = useState("");
  const [note, setNote] = useState("");

  const handleOpen = useCallback(() => {
    if (item) {
      setQuantityStr(item.default_quantity !== null ? String(item.default_quantity) : "");
      setNote(item.note ?? "");
    }
  }, [item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    const quantity = quantityStr ? parseFloat(quantityStr) : null;
    onConfirm(item, quantity !== null && !isNaN(quantity) ? quantity : null, note.trim() || null);
    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={item?.name ?? ""}
      elevated
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" onAnimationStart={handleOpen}>
        <p className="text-sm text-muted">数量・メモを調整してリストに追加できます</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={quantityStr}
            onChange={(e) => setQuantityStr(e.target.value)}
            placeholder="数量"
            min="0"
            step="0.5"
            className="flex-1 rounded border border-border-strong bg-surface px-4 py-3 text-sm text-foreground placeholder:text-subtle outline-none focus:border-focus focus:ring-2 focus:ring-focus/15"
          />
          {item?.default_unit && (
            <span className="text-sm text-muted">{item.default_unit}</span>
          )}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="メモ（任意）"
          rows={2}
          maxLength={1000}
          className="rounded border border-border-strong bg-surface px-4 py-3 text-sm text-foreground placeholder:text-subtle outline-none resize-none focus:border-focus focus:ring-2 focus:ring-focus/15"
        />
        <button
          type="submit"
          className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white active:bg-primary/90"
        >
          リストに追加
        </button>
      </form>
    </BottomSheet>
  );
}

interface StapleItemsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  stapleItems: StapleItem[];
  loading: boolean;
  categories: Category[];
  selectedCategoryId: string | null;
  profileId: string | null;
  onAddToTask: (task: {
    title: string;
    category_id: string | null;
    note: string | null;
  }) => void;
  onAddStapleItem: (data: {
    name: string;
    category_id?: string | null;
    default_quantity?: number | null;
    default_unit?: string | null;
    note?: string | null;
    icon?: string | null;
    created_by?: string | null;
  }) => void;
  onUpdateStapleItem: (
    id: string,
    updates: Partial<Pick<StapleItem, "name" | "category_id" | "default_quantity" | "default_unit" | "note" | "icon" | "sort_order">>
  ) => void;
  onDeleteStapleItem: (id: string) => void;
  onReorderStapleItems: (orderedIds: string[]) => void;
  onRecordUsage: (id: string) => void;
}

function buildTaskTitle(item: StapleItem): string {
  if (item.default_quantity === null) return item.name;
  const q = Number.isInteger(item.default_quantity)
    ? String(item.default_quantity)
    : String(item.default_quantity);
  const unit = item.default_unit ?? "";
  return `${item.name} ${q}${unit}`.trim();
}

export function StapleItemsSheet({
  isOpen,
  onClose,
  stapleItems,
  loading,
  categories,
  selectedCategoryId,
  profileId,
  onAddToTask,
  onAddStapleItem,
  onUpdateStapleItem,
  onDeleteStapleItem,
  onReorderStapleItems,
  onRecordUsage,
}: StapleItemsSheetProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StapleItem | null>(null);
  const [quickAddItem, setQuickAddItem] = useState<StapleItem | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const displayItems = searchQuery.trim()
    ? stapleItems.filter((si) =>
        si.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : stapleItems;

  const sortedItems = isEditMode && orderedIds.length > 0
    ? orderedIds
        .map((id) => displayItems.find((si) => si.id === id))
        .filter((si): si is StapleItem => si !== null)
    : displayItems;

  const handleAddToTask = useCallback(
    (item: StapleItem) => {
      const title = buildTaskTitle(item);
      onAddToTask({
        title,
        category_id: item.category_id,
        note: item.note,
      });
      onRecordUsage(item.id);
      toast.success(`「${item.name}」をリストに追加しました`);
    },
    [onAddToTask, onRecordUsage]
  );

  const handleLongPress = useCallback((item: StapleItem) => {
    if (isEditMode) return;
    setQuickAddItem(item);
    setIsQuickAddOpen(true);
  }, [isEditMode]);

  const handleQuickAddConfirm = useCallback(
    (item: StapleItem, overrideQuantity: number | null, overrideNote: string | null) => {
      const quantity = overrideQuantity ?? item.default_quantity;
      const note = overrideNote ?? item.note;
      let title = item.name;
      if (quantity !== null) {
        const q = Number.isInteger(quantity) ? String(quantity) : String(quantity);
        const unit = item.default_unit ?? "";
        title = `${item.name} ${q}${unit}`.trim();
      }
      onAddToTask({ title, category_id: item.category_id, note });
      onRecordUsage(item.id);
      toast.success(`「${item.name}」をリストに追加しました`);
    },
    [onAddToTask, onRecordUsage]
  );

  const handleEditItem = useCallback((item: StapleItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  }, []);

  const handleFormSubmit = useCallback(
    (data: {
      name: string;
      category_id: string | null;
      default_quantity: number | null;
      default_unit: string | null;
      note: string | null;
      icon: string | null;
    }) => {
      if (editingItem) {
        onUpdateStapleItem(editingItem.id, data);
      } else {
        onAddStapleItem({ ...data, created_by: profileId });
      }
      setEditingItem(null);
    },
    [editingItem, onUpdateStapleItem, onAddStapleItem, profileId]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const currentIds = orderedIds.length > 0 ? orderedIds : stapleItems.map((si) => si.id);
      const oldIndex = currentIds.indexOf(String(active.id));
      const newIndex = currentIds.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(currentIds, oldIndex, newIndex);
      setOrderedIds(newOrder);
      onReorderStapleItems(newOrder);
    },
    [orderedIds, stapleItems, onReorderStapleItems]
  );

  const handleToggleEditMode = () => {
    if (!isEditMode) {
      setOrderedIds(stapleItems.map((si) => si.id));
    }
    setIsEditMode((v) => !v);
  };

  const handleClose = () => {
    setIsEditMode(false);
    setSearchQuery("");
    onClose();
  };

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={handleClose}>
        {/* カスタムヘッダー */}
        <div className="-mx-4 -mt-2 mb-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} className="text-primary" />
              <h2 className="text-lg font-bold text-foreground">定番品</h2>
            </div>
            <button
              onClick={handleToggleEditMode}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                isEditMode
                  ? "bg-primary text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {isEditMode ? "完了" : "編集"}
            </button>
          </div>
        </div>

        {/* 検索 */}
        {!isEditMode && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
            <Search size={16} className="text-muted shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="定番品を検索"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-subtle outline-none"
            />
          </div>
        )}

        {/* アイテムグリッド */}
        {loading ? (
          <div className="grid grid-cols-3 gap-3 pb-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-surface-strong animate-pulse" />
            ))}
          </div>
        ) : sortedItems.length === 0 ? (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-3 py-12 text-center"
            >
              <span className="text-4xl">🛒</span>
              <p className="text-sm font-medium text-foreground">
                {searchQuery ? "見つかりませんでした" : "定番品がまだありません"}
              </p>
              {!searchQuery && (
                <p className="text-xs text-muted">
                  よく買うものを登録して、<br />ワンタップでリストに追加しましょう
                </p>
              )}
              {!searchQuery && (
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setIsFormOpen(true);
                  }}
                  className="mt-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white"
                >
                  最初の定番品を追加
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedItems.map((si) => si.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-3 gap-3 pb-4">
                {sortedItems.map((item) => (
                  <SortableStapleCard
                    key={item.id}
                    item={item}
                    categories={categories}
                    isEditMode={isEditMode}
                    onAddToTask={handleAddToTask}
                    onLongPress={isEditMode ? handleEditItem : handleLongPress}
                    onDelete={onDeleteStapleItem}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* 追加ボタン */}
        {!loading && (
          <button
            onClick={() => {
              setEditingItem(null);
              setIsFormOpen(true);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-medium text-muted hover:border-primary hover:text-primary transition-colors"
          >
            <Plus size={16} />
            定番品を追加
          </button>
        )}
      </BottomSheet>

      {/* 定番品の作成・編集フォーム */}
      <StapleItemFormSheet
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingItem(null);
        }}
        categories={categories}
        item={editingItem}
        defaultCategoryId={selectedCategoryId}
        onSubmit={handleFormSubmit}
      />

      {/* クイック追加（長押し） */}
      <QuickAddSheet
        isOpen={isQuickAddOpen}
        item={quickAddItem}
        onClose={() => {
          setIsQuickAddOpen(false);
          setQuickAddItem(null);
        }}
        onConfirm={handleQuickAddConfirm}
      />
    </>
  );
}
