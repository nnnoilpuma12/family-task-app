"use client";

import { useEffect, useRef, useCallback, type RefObject } from "react";
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

  // All tab IDs in order: [null, ...category ids]
  const tabIds: (string | null)[] = [null, ...categories.map((c) => c.id)];
  const activeIndex = tabIds.indexOf(selectedId);
  const safeIndex = activeIndex === -1 ? 0 : activeIndex;

  const measureTabs = useCallback(() => {
    const container = containerRef.current;
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();
    const widths: number[] = [];
    const offsets: number[] = [];

    tabButtonRefs.current.forEach((btn) => {
      if (btn) {
        const rect = btn.getBoundingClientRect();
        widths.push(rect.width);
        offsets.push(rect.left - containerRect.left);
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

  // Position indicator when selection changes
  useEffect(() => {
    requestAnimationFrame(() => {
      const bar = indicatorRef.current;
      // If a swipe transition is still in progress, skip repositioning
      // to avoid competing with snapIndicator's animated transition
      if (bar && bar.style.transition) return;
      positionIndicator(safeIndex, false);
      // Report updated measurements
      if (onTabMeasure) {
        const measurements = measureTabs();
        if (measurements) onTabMeasure(measurements);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, categories.length]);

  // Initial position (no animation) + re-measure on layout changes (e.g. font load)
  useEffect(() => {
    positionIndicator(safeIndex, false);

    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      const bar = indicatorRef.current;
      if (bar && bar.style.transition) return;
      positionIndicator(safeIndex, false);
      if (onTabMeasure) {
        const measurements = measureTabs();
        if (measurements) onTabMeasure(measurements);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
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
      <div ref={containerRef} className="relative flex px-4 py-2">
        {/* Indicator bar */}
        <div
          ref={indicatorRef}
          className="absolute top-2 bottom-2 rounded-full pointer-events-none"
          style={{
            backgroundColor: getActiveBg(safeIndex),
            willChange: "transform, width",
          }}
        />

        {/* Tab buttons */}
        <button
          ref={(el) => { tabButtonRefs.current[0] = el; }}
          onClick={() => handleSelect(null, 0)}
          className="relative z-10 flex-1 flex items-center justify-center rounded-full py-1.5 text-sm font-medium transition-colors"
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
              className="relative z-10 flex-1 flex items-center justify-center rounded-full py-1.5 text-sm font-medium transition-colors"
            >
              <span style={{ color: selectedId === cat.id ? cat.color : "#6b7280" }}>
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
