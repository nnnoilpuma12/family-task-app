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
  loading?: boolean;
}

export function CategoryTabs({
  categories,
  selectedId,
  onSelect,
  indicatorRef: externalIndicatorRef,
  onTabMeasure,
  loading = false,
}: CategoryTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalIndicatorRef = useRef<HTMLDivElement>(null);
  const indicatorRef = externalIndicatorRef ?? internalIndicatorRef;
  const tabButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const tabIds = categories.map((category) => category.id);
  const activeIndex = selectedId === null ? -1 : tabIds.indexOf(selectedId);
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
        // getBoundingClientRect() is viewport-relative. Add scrollLeft so the
        // indicator remains aligned with tabs after horizontal scrolling.
        offsets.push(rect.left - containerRect.left + container.scrollLeft);
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

  const revealTab = useCallback((index: number, behavior: ScrollBehavior) => {
    const container = containerRef.current;
    const tab = tabButtonRefs.current[index];
    if (!container || !tab) return;

    const containerRect = container.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    const leftPadding = 16;
    const rightPadding = 16;

    if (tabRect.left < containerRect.left + leftPadding) {
      container.scrollTo({
        left: Math.max(0, container.scrollLeft - (containerRect.left + leftPadding - tabRect.left)),
        behavior,
      });
    } else if (tabRect.right > containerRect.right - rightPadding) {
      container.scrollTo({
        left: container.scrollLeft + (tabRect.right - containerRect.right + rightPadding),
        behavior,
      });
    }
  }, []);

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
    if (activeIndex === -1) return;
    revealTab(activeIndex, "smooth");
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
  }, [selectedId, categories.length, activeIndex, revealTab]);

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
    revealTab(index, "smooth");
    onSelect(id);
  };

  // Get background color for active tab — Notion-style soft tinted pill
  const getActiveBg = (index: number): string => {
    const cat = categories[index];
    return cat ? `${cat.color}1a` : "#ebeae8";
  };

  if (loading && categories.length === 0) {
    return (
      <div className="flex px-4 py-2 gap-2">
        {[56, 64, 52].map((w, i) => (
          <div
            key={i}
            className="h-8 rounded-full bg-surface-strong animate-pulse"
            style={{ width: `${w}px` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        role="tablist"
        aria-label="カテゴリ"
        className="relative flex snap-x snap-proximity overflow-x-auto no-scrollbar px-4 py-2"
      >
        {/* Indicator bar */}
        <div
          ref={indicatorRef}
          className="absolute left-0 top-2 bottom-2 rounded-full pointer-events-none"
          style={{
            backgroundColor: getActiveBg(safeIndex),
            willChange: "transform, width",
          }}
        />

        {categories.map((cat, i) => (
          <button
            key={cat.id}
            ref={(el) => { tabButtonRefs.current[i] = el; }}
            onClick={() => handleSelect(cat.id, i)}
            aria-selected={selectedId === cat.id}
            role="tab"
            className="relative z-10 flex shrink-0 snap-start items-center justify-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
          >
            <span style={{ color: selectedId === cat.id ? cat.color : "var(--text-muted)" }}>
              {cat.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
