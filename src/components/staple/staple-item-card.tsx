"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { X, ShoppingCart } from "lucide-react";
import type { StapleItem, Category } from "@/types";

interface StapleItemCardProps {
  item: StapleItem;
  categories: Category[];
  isEditMode: boolean;
  onAddToTask: (item: StapleItem) => void;
  onLongPress: (item: StapleItem) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
}

function formatQuantity(quantity: number | null, unit: string | null): string {
  if (quantity === null) return "";
  const q = Number.isInteger(quantity) ? quantity.toString() : quantity.toString();
  return unit ? `${q}${unit}` : q;
}

export function StapleItemCard({
  item,
  isEditMode,
  onAddToTask,
  onLongPress,
  onDelete,
  isDragging = false,
}: StapleItemCardProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  const handlePointerDown = () => {
    if (isEditMode) return;
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress(item);
    }, 500);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!isLongPress.current && !isEditMode) {
      onAddToTask(item);
    }
  };

  const handlePointerLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const qtyText = formatQuantity(item.default_quantity, item.default_unit);

  return (
    <motion.div
      className="relative"
      animate={
        isEditMode
          ? { rotate: [-1, 1, -1, 1, 0] }
          : { rotate: 0 }
      }
      transition={
        isEditMode
          ? { repeat: Infinity, duration: 0.35, ease: "easeInOut" }
          : { duration: 0.15 }
      }
    >
      {isEditMode && (
        <button
          onClick={() => onDelete(item.id)}
          className="absolute -top-2 -left-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow"
          aria-label={`${item.name}を削除`}
        >
          <X size={12} />
        </button>
      )}

      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onContextMenu={(e) => e.preventDefault()}
        onClick={isEditMode ? () => onLongPress(item) : undefined}
        disabled={isDragging}
        className={[
          "flex w-full flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors",
          "bg-surface border-border active:bg-surface-strong",
          isEditMode ? "cursor-default" : "cursor-pointer",
          isDragging ? "opacity-50 shadow-lg" : "",
        ].join(" ")}
      >
        <span className="text-2xl leading-none" aria-hidden>
          {item.icon ?? <ShoppingCart size={20} className="text-muted" />}
        </span>
        <span className="w-full truncate text-xs font-medium text-foreground leading-tight">
          {item.name}
        </span>
        {qtyText && (
          <span className="text-[10px] text-muted leading-none">{qtyText}</span>
        )}
        {item.use_count > 0 && (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary leading-none">
            {item.use_count}回
          </span>
        )}
      </button>
    </motion.div>
  );
}
