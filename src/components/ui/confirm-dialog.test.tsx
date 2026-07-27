import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

vi.mock("framer-motion", () => ({
  motion: { div: "div" },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

describe("ConfirmDialog", () => {
  it("祖先に transform がある場合でも body 直下に描画される", () => {
    // SwipeableTaskContainer と同じく will-change: transform を持つ祖先を再現する。
    // ポータルしていないと position: fixed がこの要素基準になり、
    // 中身の高さ（タスク数）で表示位置が変わってしまう。
    const { container } = render(
      <div style={{ willChange: "transform" }}>
        <ConfirmDialog
          isOpen
          title="完了済みタスクを削除"
          confirmLabel="削除する"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      </div>
    );

    const dialog = screen.getByRole("dialog");
    expect(container.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
  });

  it("閉じているときはダイアログを描画しない", () => {
    render(
      <ConfirmDialog
        isOpen={false}
        title="完了済みタスクを削除"
        confirmLabel="削除する"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
