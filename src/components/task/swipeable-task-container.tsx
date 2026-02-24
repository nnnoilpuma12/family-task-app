"use client";

import { useRef, useMemo, type RefObject } from "react";
import { useSwipeableTab, type IndicatorRefs } from "@/hooks/use-swipeable-tab";
import type { Category } from "@/types";

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

  // Build ordered category id list: category ids only
  const categoryOrder = useMemo(
    () => categories.map((c) => c.id),
    [categories]
  );

  const activeIndex = selectedCategoryId ? categoryOrder.indexOf(selectedCategoryId) : -1;
  const safeIndex = activeIndex === -1 ? 0 : activeIndex;

  useSwipeableTab({
    containerRef,
    tabCount: categoryOrder.length,
    activeIndex: safeIndex,
    onChangeIndex: (index: number) => {
      onCategoryChange(categoryOrder[index] ?? null);
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
