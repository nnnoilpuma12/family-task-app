"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { StapleItemCard } from "@/components/staple/staple-item-card";
import type { StapleItem, Category } from "@/types";

interface SortableStapleCardProps {
  item: StapleItem;
  categories: Category[];
  isEditMode: boolean;
  onAddToTask: (item: StapleItem) => void;
  onLongPress: (item: StapleItem) => void;
  onDelete: (id: string) => void;
}

export function SortableStapleCard(props: SortableStapleCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id,
    disabled: !props.isEditMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="h-full" {...(props.isEditMode ? { ...attributes, ...listeners } : {})}>
      <StapleItemCard {...props} isDragging={isDragging} />
    </div>
  );
}
