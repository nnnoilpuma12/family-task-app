"use client";

import { useRef, useMemo } from "react";
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

  // Keep swipe order aligned with the user-defined category tabs.
  const categoryOrder = useMemo(() => categories.map((category) => category.id), [categories]);

  const activeIndex = selectedCategoryId === null ? -1 : categoryOrder.indexOf(selectedCategoryId);
  const safeIndex = activeIndex === -1 ? 0 : activeIndex;

  useSwipeableTab({
    containerRef,
    tabCount: categoryOrder.length,
    activeIndex: safeIndex,
    onChangeIndex: (index: number) => {
      const next = categoryOrder[index];
      if (next) onCategoryChange(next);
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
