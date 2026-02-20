"use client";

import { useRef, useEffect, useCallback } from "react";

interface UseCategorySwipeOptions {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

export function useCategorySwipe(
  containerRef: React.RefObject<HTMLDivElement | null>,
  { onSwipeLeft, onSwipeRight }: UseCategorySwipeOptions
) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const swiping = useRef(false);
  const directionLocked = useRef<"horizontal" | "vertical" | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    // iOS back gesture avoidance: ignore touches starting within 20px of left edge
    if (touch.clientX < 20) return;

    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    touchStartTime.current = Date.now();
    swiping.current = true;
    directionLocked.current = null;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!swiping.current) return;

    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX.current;
    const dy = touch.clientY - touchStartY.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Lock direction after minimal movement
    if (directionLocked.current === null && (absDx > 10 || absDy > 10)) {
      if (absDx > absDy * 2) {
        directionLocked.current = "horizontal";
      } else {
        directionLocked.current = "vertical";
        swiping.current = false;
        return;
      }
    }

    if (directionLocked.current === "horizontal" && absDx > 20) {
      // Left swipe (next category): skip if on a task item (conflicts with swipe-to-delete)
      if (dx < 0) {
        const target = e.target as HTMLElement;
        if (target.closest("[data-task-item]")) {
          swiping.current = false;
          return;
        }
      }
      e.preventDefault();
    }
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!swiping.current || directionLocked.current !== "horizontal") {
      swiping.current = false;
      return;
    }

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX.current;
    const absDx = Math.abs(dx);
    const elapsed = Date.now() - touchStartTime.current;
    const velocity = absDx / elapsed; // px/ms

    const thresholdMet = absDx > 80 || (velocity > 0.3 && absDx > 30);

    if (thresholdMet) {
      if (dx < 0) {
        onSwipeLeft();
      } else {
        onSwipeRight();
      }
    }

    swiping.current = false;
    directionLocked.current = null;
  }, [onSwipeLeft, onSwipeRight]);

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
}
