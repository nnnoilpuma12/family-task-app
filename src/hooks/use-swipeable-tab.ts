"use client";

import { useRef, useEffect, useCallback, type RefObject } from "react";

export interface IndicatorRefs {
  barRef: RefObject<HTMLDivElement | null>;
  tabWidths: number[];
  tabOffsets: number[];
}

interface UseSwipeableTabOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  tabCount: number;
  activeIndex: number;
  onChangeIndex: (index: number) => void;
  indicatorRefs?: IndicatorRefs;
}

export function useSwipeableTab({
  containerRef,
  tabCount,
  activeIndex,
  onChangeIndex,
  indicatorRefs,
}: UseSwipeableTabOptions) {
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const currentDx = useRef(0);
  const swiping = useRef(false);
  const directionLocked = useRef<"horizontal" | "vertical" | null>(null);

  // Keep latest values in refs to avoid stale closures in event handlers
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const tabCountRef = useRef(tabCount);
  tabCountRef.current = tabCount;
  const onChangeIndexRef = useRef(onChangeIndex);
  onChangeIndexRef.current = onChangeIndex;
  const indicatorRefsRef = useRef(indicatorRefs);
  indicatorRefsRef.current = indicatorRefs;

  const updateIndicator = useCallback((progress: number) => {
    const ind = indicatorRefsRef.current;
    if (!ind?.barRef.current) return;
    const { tabWidths, tabOffsets } = ind;
    const idx = activeIndexRef.current;

    // progress: -1 = fully left (prev), 0 = current, 1 = fully right (next)
    const targetIdx = progress > 0
      ? Math.min(idx + 1, tabCountRef.current - 1)
      : Math.max(idx - 1, 0);

    const absProgress = Math.min(Math.abs(progress), 1);
    const fromWidth = tabWidths[idx] ?? 0;
    const toWidth = tabWidths[targetIdx] ?? 0;
    const fromOffset = tabOffsets[idx] ?? 0;
    const toOffset = tabOffsets[targetIdx] ?? 0;

    const currentWidth = fromWidth + (toWidth - fromWidth) * absProgress;
    const currentOffset = fromOffset + (toOffset - fromOffset) * absProgress;

    ind.barRef.current.style.width = `${currentWidth}px`;
    ind.barRef.current.style.transform = `translateX(${currentOffset}px)`;
  }, []);

  const snapIndicator = useCallback((toIndex: number) => {
    const ind = indicatorRefsRef.current;
    if (!ind?.barRef.current) return;
    const { tabWidths, tabOffsets } = ind;

    ind.barRef.current.style.transition = "transform 0.25s ease-out, width 0.25s ease-out";
    ind.barRef.current.style.width = `${tabWidths[toIndex] ?? 0}px`;
    ind.barRef.current.style.transform = `translateX(${tabOffsets[toIndex] ?? 0}px)`;

    const cleanup = () => {
      if (ind.barRef.current) {
        ind.barRef.current.style.transition = "";
      }
    };
    ind.barRef.current.addEventListener("transitionend", cleanup, { once: true });
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    // iOS back gesture avoidance
    if (touch.clientX < 20) return;

    startX.current = touch.clientX;
    startY.current = touch.clientY;
    startTime.current = Date.now();
    currentDx.current = 0;
    swiping.current = true;
    directionLocked.current = null;

    // Remove any lingering transition
    const container = containerRef.current;
    if (container) {
      container.style.transition = "";
    }
  }, [containerRef]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!swiping.current) return;

    const touch = e.touches[0];
    const dx = touch.clientX - startX.current;
    const dy = touch.clientY - startY.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Lock direction
    if (directionLocked.current === null && (absDx > 10 || absDy > 10)) {
      if (absDx > absDy * 2) {
        directionLocked.current = "horizontal";
      } else {
        directionLocked.current = "vertical";
        swiping.current = false;
        return;
      }
    }

    if (directionLocked.current !== "horizontal") return;

    e.preventDefault();

    const idx = activeIndexRef.current;
    const atStart = idx === 0 && dx > 0;
    const atEnd = idx === tabCountRef.current - 1 && dx < 0;

    // Over-scroll resistance at edges
    const effectiveDx = (atStart || atEnd) ? dx * 0.3 : dx;
    currentDx.current = effectiveDx;

    // Update container translateX
    const container = containerRef.current;
    if (container) {
      container.style.transform = `translateX(${effectiveDx}px)`;
    }

    // Update indicator
    const containerWidth = container?.offsetWidth ?? 375;
    const progress = effectiveDx / containerWidth;
    // progress > 0 means swiping right (going to prev), < 0 means swiping left (going to next)
    // For indicator: positive progress = moving toward previous tab
    updateIndicator(-progress);
  }, [containerRef, updateIndicator]);

  const handleTouchEnd = useCallback(() => {
    if (!swiping.current || directionLocked.current !== "horizontal") {
      swiping.current = false;
      return;
    }

    const container = containerRef.current;
    const dx = currentDx.current;
    const elapsed = Date.now() - startTime.current;
    const velocity = Math.abs(dx) / elapsed; // px/ms
    const containerWidth = container?.offsetWidth ?? 375;

    const shouldSwipe = velocity > 0.3 || Math.abs(dx) > containerWidth * 0.3;
    const idx = activeIndexRef.current;
    let targetIndex = idx;

    if (shouldSwipe) {
      if (dx < 0 && idx < tabCountRef.current - 1) {
        targetIndex = idx + 1; // swipe left → next
      } else if (dx > 0 && idx > 0) {
        targetIndex = idx - 1; // swipe right → prev
      }
    }

    // Snap container
    if (container) {
      const snapX = targetIndex === idx ? 0 : (targetIndex > idx ? -containerWidth : containerWidth);
      container.style.transition = "transform 0.25s ease-out";
      container.style.transform = `translateX(${snapX}px)`;

      const onTransitionEnd = () => {
        container.style.transition = "";
        if (targetIndex !== idx) {
          // Update state first so React renders new content,
          // then reset transform in the same frame to avoid flicker
          onChangeIndexRef.current(targetIndex);
        }
        container.style.transform = "";
      };
      container.addEventListener("transitionend", onTransitionEnd, { once: true });
    }

    // Snap indicator
    snapIndicator(targetIndex);

    swiping.current = false;
    directionLocked.current = null;
    currentDx.current = 0;
  }, [containerRef, snapIndicator]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { snapIndicator };
}
