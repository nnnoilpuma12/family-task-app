import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CategoryTabs, type TabMeasurements } from "@/components/category/category-tabs";
import type { Category } from "@/types";

const HOUSEHOLD_ID = "household-1";

function makeCategory(id: string, name: string, sortOrder: number): Category {
  return {
    id,
    household_id: HOUSEHOLD_ID,
    name,
    color: "#3b82f6",
    icon: null,
    sort_order: sortOrder,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const categories = [
  makeCategory("shopping", "買い物", 0),
  makeCategory("chores", "家事", 1),
  makeCategory("outing", "お出かけ", 2),
];

function rect(left: number, right: number): DOMRect {
  return {
    x: left,
    y: 0,
    width: right - left,
    height: 32,
    top: 0,
    right,
    bottom: 32,
    left,
    toJSON: () => ({}),
  };
}

describe("CategoryTabs", () => {
  it("ユーザー定義カテゴリだけを表示する", () => {
    render(
      <CategoryTabs categories={categories} selectedId="shopping" onSelect={vi.fn()} />
    );

    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.queryByRole("tab", { name: "すべて" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "未分類" })).not.toBeInTheDocument();
  });

  it("カテゴリをタップするとその id を通知する", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <CategoryTabs categories={categories} selectedId="shopping" onSelect={onSelect} />
    );

    await user.click(screen.getByRole("tab", { name: "家事" }));

    expect(onSelect).toHaveBeenCalledWith("chores");
  });

  it("選択タブが右端から見切れる場合は表示領域内へスクロールする", () => {
    const { rerender } = render(
      <CategoryTabs categories={categories} selectedId="shopping" onSelect={vi.fn()} />
    );
    const tablist = screen.getByRole("tablist", { name: "カテゴリ" });
    const outingTab = screen.getByRole("tab", { name: "お出かけ" });
    const scrollTo = vi.fn();
    tablist.scrollTo = scrollTo;
    tablist.getBoundingClientRect = () => rect(0, 200);
    outingTab.getBoundingClientRect = () => rect(180, 260);

    rerender(
      <CategoryTabs categories={categories} selectedId="outing" onSelect={vi.fn()} />
    );

    expect(scrollTo).toHaveBeenCalledWith({ left: 76, behavior: "smooth" });
  });

  it("スクロール量を含めたインジケータ座標を通知する", () => {
    const onTabMeasure = vi.fn<(measurements: TabMeasurements) => void>();
    const { rerender } = render(
      <CategoryTabs
        categories={categories}
        selectedId="shopping"
        onSelect={vi.fn()}
        onTabMeasure={onTabMeasure}
      />
    );
    const tablist = screen.getByRole("tablist", { name: "カテゴリ" });
    const tabs = screen.getAllByRole("tab");
    Object.defineProperty(tablist, "scrollLeft", { value: 80, writable: true });
    tablist.getBoundingClientRect = () => rect(20, 220);
    tabs[0].getBoundingClientRect = () => rect(-44, 16);
    tabs[1].getBoundingClientRect = () => rect(16, 76);
    tabs[2].getBoundingClientRect = () => rect(76, 156);

    onTabMeasure.mockClear();
    rerender(
      <CategoryTabs
        categories={[...categories]}
        selectedId="shopping"
        onSelect={vi.fn()}
        onTabMeasure={onTabMeasure}
      />
    );

    expect(onTabMeasure).toHaveBeenCalledWith({
      tabWidths: [60, 60, 80],
      tabOffsets: [16, 76, 136],
    });
  });
});
