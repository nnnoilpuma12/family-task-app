import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// framer-motion は jsdom でアニメーションが動作しないためモック
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      initial: _i,
      animate: _a,
      exit: _e,
      transition: _t,
      ...props
    }: React.ComponentProps<"div"> & Record<string, unknown>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function renderDialog(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <ConfirmDialog
      isOpen
      title="完了済みタスクを削除"
      description="11件の完了済みタスクを削除します。"
      confirmLabel="削除する"
      variant="destructive"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />
  );
  return { onConfirm, onCancel, ...utils };
}

describe("ConfirmDialog", () => {
  it("開いているときにタイトルと説明を表示する", () => {
    renderDialog();

    expect(screen.getByText("完了済みタスクを削除")).toBeInTheDocument();
    expect(screen.getByText("11件の完了済みタスクを削除します。")).toBeInTheDocument();
  });

  it("閉じているときは何も表示しない", () => {
    renderDialog({ isOpen: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // transform / will-change を持つ祖先（SwipeableTaskContainer など）が
  // position: fixed の包含ブロックになると表示位置がリスト量に応じてずれるため、
  // ダイアログは必ず document.body 直下へポータルされる必要がある
  it("呼び出し元のツリーではなく document.body へポータルされる", () => {
    const { container } = renderDialog();

    expect(container).toBeEmptyDOMElement();

    const dialog = screen.getByRole("dialog");
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog).toHaveClass("fixed");
  });

  it("確認ボタンとキャンセルボタンでコールバックを呼ぶ", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog();

    await user.click(screen.getByRole("button", { name: "削除する" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Escape キーでキャンセルする", async () => {
    const user = userEvent.setup();
    const { onCancel } = renderDialog();

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
