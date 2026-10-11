import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StapleQuickAddSheet } from "@/components/staple/staple-quick-add-sheet";
import type { StapleItem } from "@/types";

vi.mock("@/components/ui/bottom-sheet", () => ({
  BottomSheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function item(id: string, quantity: number, note: string): StapleItem {
  return {
    id,
    household_id: "household",
    name: id,
    category_id: null,
    created_by: null,
    icon: null,
    last_used_at: null,
    default_quantity: quantity,
    default_unit: null,
    note,
    use_count: 0,
    sort_order: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

describe("StapleQuickAddSheet", () => {
  it("別アイテムへの切替時に数量とメモを初期化する", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const first = item("first", 2, "first note");
    const second = item("second", 5, "second note");
    const { rerender } = render(<StapleQuickAddSheet isOpen item={first} onConfirm={onConfirm} onClose={onClose} />);
    await user.clear(screen.getByPlaceholderText("数量"));
    await user.type(screen.getByPlaceholderText("数量"), "8");
    rerender(<StapleQuickAddSheet isOpen item={second} onConfirm={onConfirm} onClose={onClose} />);
    expect(screen.getByPlaceholderText("数量")).toHaveValue(5);
    expect(screen.getByPlaceholderText("メモ（任意）")).toHaveValue("second note");
    await user.click(screen.getByRole("button", { name: "リストに追加" }));
    expect(onConfirm).toHaveBeenCalledWith(second, 5, "second note");
  });
});
