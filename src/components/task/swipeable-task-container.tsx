"use client";

import { useRef, useMemo } from "react";
import { useSwipeableTab, type IndicatorRefs } from "@/hooks/use-swipeable-tab";
import type { Category } from "@/types";
import { UNCATEGORIZED_CATEGORY_ID } from "@/components/category/category-tabs";

interface SwipeableTaskContainerProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onCategoryChange: (id: string | null) => void;
  indicatorRefs?: IndicatorRefs;
  children: React.ReactNode;
}

export function SwipeableTaskContainer({
  categories,
  selectedCategoryId,
  onCategoryChange,
  indicatorRefs,
  children,
}: SwipeableTaskContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep swipe order aligned with the visible tabs.
  const categoryOrder = useMemo(
    () => ["__all__", UNCATEGORIZED_CATEGORY_ID, ...categories.map((c) => c.id)],
    [categories]
  );

  const activeIndex = selectedCategoryId === null ? 0 : categoryOrder.indexOf(selectedCategoryId);
  const safeIndex = activeIndex === -1 ? 0 : activeIndex;

  useSwipeableTab({
    containerRef,
    tabCount: categoryOrder.length,
    activeIndex: safeIndex,
    onChangeIndex: (index: number) => {
      const next = categoryOrder[index];
      onCategoryChange(next === "__all__" || !next ? null : next);
    },
    indicatorRefs,
  });

  return (
    <div
      ref={containerRef}
      className="overflow-hidden min-h-[calc(100dvh-7rem)]"
      style={{ willChange: "transform" }}
    >
      {children}
    </div>
  );
}
