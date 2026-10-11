import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StapleItemFormSheet } from "@/components/staple/staple-item-form-sheet";

vi.mock("@/components/ui/bottom-sheet", () => ({
  BottomSheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/task/category-picker", () => ({
  CategoryPicker: () => <div>カテゴリ</div>,
}));

describe("StapleItemFormSheet", () => {
  it("保存失敗時は入力内容を残して再試行できる", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockResolvedValueOnce({ error: new Error("offline") }).mockResolvedValueOnce({ error: null });
    render(<StapleItemFormSheet isOpen onClose={onClose} categories={[]} onSubmit={onSubmit} />);
    await user.type(screen.getByPlaceholderText("定番品の名前"), "牛乳");
    await user.click(screen.getByRole("button", { name: "追加" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByPlaceholderText("定番品の名前")).toHaveValue("牛乳");
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "追加" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
