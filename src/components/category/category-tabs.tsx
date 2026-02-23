"use client";

import { useEffect, useRef, useState, useCallback, type RefObject } from "react";
import type { Category } from "@/types";

export interface TabMeasurements {
  tabWidths: number[];
  tabOffsets: number[];
}

interface CategoryTabsProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  indicatorRef?: RefObject<HTMLDivElement | null>;
  onTabMeasure?: (measurements: TabMeasurements) => void;
}

export function CategoryTabs({
  categories,
  selectedId,
  onSelect,
  indicatorRef: externalIndicatorRef,
  onTabMeasure,
}: CategoryTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalIndicatorRef = useRef<HTMLDivElement>(null);
  const indicatorRef = externalIndicatorRef ?? internalIndicatorRef;
  const tabButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Fade gradient state
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const updateFades = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 4);
    setShowRightFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    updateFades();
    el.addEventListener("scroll", updateFades, { passive: true });
    return () => el.removeEventListener("scroll", updateFades);
  }, [updateFades, categories.length]);

  // All tab IDs in order: [null, ...category ids]
  const tabIds: (string | null)[] = [null, ...categories.map((c) => c.id)];
  const activeIndex = tabIds.indexOf(selectedId);
  const safeIndex = activeIndex === -1 ? 0 : activeIndex;

  const measureTabs = useCallback(() => {
    const container = containerRef.current;
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const widths: number[] = [];
    const offsets: number[] = [];

    tabButtonRefs.current.forEach((btn) => {
      if (btn) {
        const rect = btn.getBoundingClientRect();
        widths.push(rect.width);
        offsets.push(rect.left - containerRect.left + scrollLeft);
      }
    });

    return { tabWidths: widths, tabOffsets: offsets };
  }, []);

  // Position indicator on active tab
  const positionIndicator = useCallback((index: number, animate: boolean) => {
    const bar = indicatorRef.current;
    if (!bar) return;

    const measurements = measureTabs();
    if (!measurements) return;

    const width = measurements.tabWidths[index] ?? 0;
    const offset = measurements.tabOffsets[index] ?? 0;

    if (animate) {
      bar.style.transition = "transform 0.25s ease-out, width 0.25s ease-out";
    } else {
      bar.style.transition = "";
    }
    bar.style.width = `${width}px`;
    bar.style.transform = `translateX(${offset}px)`;

    if (animate) {
      const cleanup = () => { bar.style.transition = ""; };
      bar.addEventListener("transitionend", cleanup, { once: true });
    }
  }, [indicatorRef, measureTabs]);

  // Report measurements to parent for swipe indicator sync
  useEffect(() => {
    if (!onTabMeasure) return;
    const measurements = measureTabs();
    if (measurements) {
      onTabMeasure(measurements);
    }
  }, [categories, onTabMeasure, measureTabs]);

  // Auto-scroll to active tab and position indicator
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeBtn = tabButtonRefs.current[safeIndex];
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
    // Position indicator after scroll settles
    requestAnimationFrame(() => {
      positionIndicator(safeIndex, false);
      // Re-measure after scroll animation
      const timer = setTimeout(() => {
        positionIndicator(safeIndex, false);
        updateFades();
        // Report updated measurements
        if (onTabMeasure) {
          const measurements = measureTabs();
          if (measurements) onTabMeasure(measurements);
        }
      }, 350);
      return () => clearTimeout(timer);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, categories.length]);

  // Initial position (no animation)
  useEffect(() => {
    positionIndicator(safeIndex, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (id: string | null, index: number) => {
    positionIndicator(index, true);
    onSelect(id);
  };

  // Get background color for active tab
  const getActiveBg = (index: number): string => {
    if (index === 0) return "#e0e7ff"; // indigo-100
    const cat = categories[index - 1];
    return cat ? `${cat.color}20` : "#e0e7ff";
  };

  return (
    <div className="relative">
      <div ref={containerRef} className="relative flex gap-1 overflow-x-auto px-4 py-2 no-scrollbar">
        {/* Indicator bar */}
        <div
          ref={indicatorRef}
          className="absolute top-2 h-[calc(100%-16px)] rounded-full pointer-events-none"
          style={{
            backgroundColor: getActiveBg(safeIndex),
            willChange: "transform, width",
          }}
        />

        {/* Tab buttons */}
        <button
          ref={(el) => { tabButtonRefs.current[0] = el; }}
          onClick={() => handleSelect(null, 0)}
          className="relative z-10 shrink-0 inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium leading-none transition-colors"
        >
          <span className={selectedId === null ? "text-indigo-700" : "text-gray-600"}>
            すべて
          </span>
        </button>
        {categories.map((cat, i) => {
          const tabIndex = i + 1;
          return (
            <button
              key={cat.id}
              ref={(el) => { tabButtonRefs.current[tabIndex] = el; }}
              onClick={() => handleSelect(cat.id, tabIndex)}
              className="relative z-10 shrink-0 inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium leading-none transition-colors"
            >
              <span style={{ color: selectedId === cat.id ? cat.color : "#6b7280" }}>
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Left fade gradient */}
      {showLeftFade && (
        <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent pointer-events-none z-20" />
      )}

      {/* Right fade gradient */}
      {showRightFade && (
        <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent pointer-events-none z-20" />
      )}
    </div>
  );
}
