"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCategorySwipe } from "@/hooks/use-category-swipe";
import type { Category } from "@/types";

interface SwipeableTaskContainerProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onCategoryChange: (id: string | null) => void;
  children: React.ReactNode;
}

export function SwipeableTaskContainer({
  categories,
  selectedCategoryId,
  onCategoryChange,
  children,
}: SwipeableTaskContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState(1);
  const prevCategoryId = useRef<string | null>(selectedCategoryId);

  // Build ordered category id list: [null, ...category ids]
  const categoryOrder = useMemo(
    () => [null, ...categories.map((c) => c.id)] as (string | null)[],
    [categories]
  );

  // Update direction when selectedCategoryId changes
  useEffect(() => {
    if (selectedCategoryId !== prevCategoryId.current) {
      const prevIdx = categoryOrder.indexOf(prevCategoryId.current);
      const curIdx = categoryOrder.indexOf(selectedCategoryId);
      const safePrev = prevIdx === -1 ? 0 : prevIdx;
      const safeCur = curIdx === -1 ? 0 : curIdx;
      setDirection(safeCur >= safePrev ? 1 : -1); // eslint-disable-line react-hooks/set-state-in-effect
      prevCategoryId.current = selectedCategoryId;
    }
  }, [selectedCategoryId, categoryOrder]);

  const onSwipeLeft = useCallback(() => {
    const idx = categoryOrder.indexOf(selectedCategoryId);
    const safeIdx = idx === -1 ? 0 : idx;
    if (safeIdx < categoryOrder.length - 1) {
      onCategoryChange(categoryOrder[safeIdx + 1]);
    }
  }, [categoryOrder, selectedCategoryId, onCategoryChange]);

  const onSwipeRight = useCallback(() => {
    const idx = categoryOrder.indexOf(selectedCategoryId);
    const safeIdx = idx === -1 ? 0 : idx;
    if (safeIdx > 0) {
      onCategoryChange(categoryOrder[safeIdx - 1]);
    }
  }, [categoryOrder, selectedCategoryId, onCategoryChange]);

  useCategorySwipe(containerRef, { onSwipeLeft, onSwipeRight });

  const variants = {
    enter: (dir: number) => ({ x: `${dir * 30}%`, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: `${dir * -30}%`, opacity: 0 }),
  };

  return (
    <div ref={containerRef} className="overflow-hidden">
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={selectedCategoryId ?? "__all__"}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
