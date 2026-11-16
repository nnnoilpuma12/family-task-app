import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TaskDetailModal } from "@/components/task/task-detail-modal";
import type { Task, Category, Profile } from "@/types";

const captureDragEnd = vi.hoisted(() => vi.fn<(handler: unknown) => void>());

// framer-motion は jsdom でアニメーションが動作しないためモック
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<"div"> & Record<string, unknown>) => {
      if (props.drag === "y") captureDragEnd(props.onDragEnd);
      const motionProps = new Set(["initial", "animate", "exit", "transition", "drag", "dragConstraints", "dragElastic", "onDragEnd"]);
      const domProps = Object.fromEntries(Object.entries(props).filter(([key]) => !motionProps.has(key)));
      return <div {...domProps}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const HOUSEHOLD_ID = "household-1";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "テストタスク",
    category_id: null,
    due_date: null,
    memo: null,
    url: null,
    created_by: null,
    household_id: HOUSEHOLD_ID,
    is_done: false,
    sort_order: 0,
    completed_at: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat-1",
    household_id: HOUSEHOLD_ID,
    name: "仕事",
    color: "#ff5722",
    icon: null,
    sort_order: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onRestore: vi.fn(),
  categories: [] as Category[],
  members: [] as Profile[],
  onUpdate: vi.fn(),
  onDelete: vi.fn(),
};

describe("TaskDetailModal", () => {
  describe("未保存の変更の確認", () => {
    function renderDetail(task = makeTask()) {
      const onClose = vi.fn();
      const onUpdate = vi.fn();
      const onDelete = vi.fn();
      const props = { ...defaultProps, task, onClose, onUpdate, onDelete };
      return { ...render(<TaskDetailModal {...props} categories={[makeCategory()]} />), props };
    }

    it("変更がない場合は確認せずに閉じる", async () => {
      const user = userEvent.setup();
      const { props } = renderDetail();

      await user.keyboard("{Escape}");

      expect(props.onClose).toHaveBeenCalledOnce();
      expect(screen.queryByText("保存せずに閉じますか？")).not.toBeInTheDocument();
    });

    it.each([
      { field: "タイトル", edit: () => fireEvent.change(screen.getByDisplayValue("テストタスク"), { target: { value: "変更したタスク" } }) },
      { field: "カテゴリ", edit: () => fireEvent.click(screen.getByRole("button", { name: "仕事" })) },
      { field: "期限", edit: () => fireEvent.click(screen.getByRole("button", { name: "明日" })) },
      { field: "メモ", edit: () => fireEvent.change(screen.getByPlaceholderText("メモを入力..."), { target: { value: "変更したメモ" } }) },
      { field: "URL", edit: () => fireEvent.change(screen.getByPlaceholderText("https://..."), { target: { value: "https://example.com" } }) },
    ])("$field を変更して閉じると確認を表示する", async ({ edit }) => {
      const user = userEvent.setup();
      const { props } = renderDetail();

      edit();
      await user.keyboard("{Escape}");

      expect(screen.getByRole("dialog", { name: "保存せずに閉じますか？" })).toBeInTheDocument();
      expect(props.onClose).not.toHaveBeenCalled();
      expect(props.onUpdate).not.toHaveBeenCalled();
    });

    it("背景をタップしても変更がある場合は確認する", async () => {
      const user = userEvent.setup();
      const { props } = renderDetail();
      fireEvent.change(screen.getByDisplayValue("テストタスク"), { target: { value: "変更したタスク" } });
      const backdrop = screen.getByRole("dialog", { name: "タスク詳細" }).previousElementSibling;
      if (!backdrop) throw new Error("モーダルの背景がありません");

      await user.click(backdrop);

      expect(screen.getByRole("dialog", { name: "保存せずに閉じますか？" })).toBeInTheDocument();
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it("下方向のスワイプで閉じる場合も変更を確認する", () => {
      const { props } = renderDetail();
      fireEvent.change(screen.getByDisplayValue("テストタスク"), { target: { value: "変更したタスク" } });
      const onDragEnd = captureDragEnd.mock.lastCall?.[0];
      if (typeof onDragEnd !== "function") throw new Error("スワイプのハンドラがありません");

      act(() => onDragEnd(null, { offset: { y: 120 } }));

      expect(screen.getByRole("dialog", { name: "保存せずに閉じますか？" })).toBeInTheDocument();
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it.each(["キャンセル", "Escape", "背景"])("確認を %s で取り消すと編集内容を保持する", async (action) => {
      const user = userEvent.setup();
      const { props } = renderDetail();
      fireEvent.change(screen.getByDisplayValue("テストタスク"), { target: { value: "変更したタスク" } });
      await user.keyboard("{Escape}");

      if (action === "キャンセル") {
        await user.click(screen.getByRole("button", { name: "キャンセル" }));
      } else if (action === "Escape") {
        await user.keyboard("{Escape}");
      } else {
        const backdrop = screen.getByRole("dialog", { name: "保存せずに閉じますか？" }).firstElementChild;
        if (!backdrop) throw new Error("確認ダイアログの背景がありません");
        await user.click(backdrop);
      }

      expect(screen.queryByText("保存せずに閉じますか？")).not.toBeInTheDocument();
      expect(screen.getByDisplayValue("変更したタスク")).toBeInTheDocument();
      expect(props.onClose).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "保存" }));
      expect(props.onUpdate).toHaveBeenCalledWith("task-1", expect.objectContaining({ title: "変更したタスク" }));
      expect(props.onClose).toHaveBeenCalledOnce();
    });

    it("保存せずに閉じるを選択した場合だけ変更を保存せずに閉じる", async () => {
      const user = userEvent.setup();
      const { props } = renderDetail();
      fireEvent.change(screen.getByDisplayValue("テストタスク"), { target: { value: "変更したタスク" } });
      await user.keyboard("{Escape}");

      await user.click(screen.getByRole("button", { name: "保存せずに閉じる" }));

      expect(props.onClose).toHaveBeenCalledOnce();
      expect(props.onUpdate).not.toHaveBeenCalled();
      expect(props.onDelete).not.toHaveBeenCalled();
    });

    it("変更を元に戻した場合は確認せずに閉じる", async () => {
      const user = userEvent.setup();
      const { props } = renderDetail();
      const titleInput = screen.getByDisplayValue("テストタスク");
      fireEvent.change(titleInput, { target: { value: "変更したタスク" } });
      fireEvent.change(titleInput, { target: { value: "テストタスク" } });
      fireEvent.change(screen.getByPlaceholderText("メモを入力..."), { target: { value: "メモ" } });
      fireEvent.change(screen.getByPlaceholderText("メモを入力..."), { target: { value: "" } });
      await user.keyboard("{Escape}");

      expect(props.onClose).toHaveBeenCalledOnce();
      expect(screen.queryByText("保存せずに閉じますか？")).not.toBeInTheDocument();
    });

    it("既存のメモを空にした場合も変更として確認する", async () => {
      const user = userEvent.setup();
      const { props } = renderDetail(makeTask({ memo: "元のメモ" }));
      await user.clear(screen.getByPlaceholderText("メモを入力..."));
      await user.keyboard("{Escape}");

      expect(screen.getByRole("dialog", { name: "保存せずに閉じますか？" })).toBeInTheDocument();
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it("再び開いたときに破棄した変更や確認ダイアログを持ち越さない", async () => {
      const user = userEvent.setup();
      const { props, rerender } = renderDetail();
      fireEvent.change(screen.getByDisplayValue("テストタスク"), { target: { value: "変更したタスク" } });
      await user.keyboard("{Escape}");
      await user.click(screen.getByRole("button", { name: "保存せずに閉じる" }));
      rerender(<TaskDetailModal {...props} task={null} isOpen={false} />);

      rerender(<TaskDetailModal {...props} />);

      expect(screen.getByDisplayValue("テストタスク")).toBeInTheDocument();
      expect(screen.queryByText("保存せずに閉じますか？")).not.toBeInTheDocument();
    });

    it.each(["保存", "タスクを削除"])("%s ボタンでは破棄の確認を表示しない", async (button) => {
      const user = userEvent.setup();
      const { props } = renderDetail();
      fireEvent.change(screen.getByDisplayValue("テストタスク"), { target: { value: "変更したタスク" } });

      await user.click(screen.getByRole("button", { name: button }));

      expect(props.onClose).toHaveBeenCalledOnce();
      expect(screen.queryByText("保存せずに閉じますか？")).not.toBeInTheDocument();
      expect(button === "保存" ? props.onUpdate : props.onDelete).toHaveBeenCalledOnce();
    });
  });

  describe("URLバリデーション", () => {
    it("有効なURL (https) では外部リンクが表示される", () => {
      const task = makeTask({ url: "https://example.com" });
      render(<TaskDetailModal {...defaultProps} task={task} />);

      const link = screen.getByRole("link");
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "https://example.com");
    });

    it("無効なURL (スキームなし) では保存時にエラーメッセージが表示される", async () => {
      const user = userEvent.setup();
      const task = makeTask({ url: null });
      render(<TaskDetailModal {...defaultProps} task={task} />);

      const urlInput = screen.getByPlaceholderText("https://...");
      await user.clear(urlInput);
      await user.type(urlInput, "example.com");

      await user.click(screen.getByText("保存"));

      expect(
        screen.getByText("URLはhttpまたはhttpsで始まる必要があります")
      ).toBeInTheDocument();
    });

    it("URL 空欄ではバリデーションエラーが出ない", async () => {
      const user = userEvent.setup();
      const task = makeTask({ url: null });
      render(<TaskDetailModal {...defaultProps} task={task} onUpdate={vi.fn()} />);

      await user.click(screen.getByText("保存"));

      expect(
        screen.queryByText("URLはhttpまたはhttpsで始まる必要があります")
      ).not.toBeInTheDocument();
    });
  });

  describe("タイトルバリデーション", () => {
    it("タイトルが空白のみの場合は保存されない", async () => {
      const user = userEvent.setup();
      const task = makeTask({ title: "元のタイトル" });
      const onUpdate = vi.fn();
      render(
        <TaskDetailModal {...defaultProps} task={task} onUpdate={onUpdate} />
      );

      const titleInput = screen.getByDisplayValue("元のタイトル");
      await user.clear(titleInput);
      await user.type(titleInput, "   ");

      await user.click(screen.getByText("保存"));

      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe("カテゴリ選択", () => {
    it("showNone=false のため「なし」ボタンが表示されない", () => {
      const category = makeCategory();
      const task = makeTask({ category_id: "cat-1" });
      render(
        <TaskDetailModal {...defaultProps} task={task} categories={[category]} />
      );

      expect(screen.queryByText("なし")).not.toBeInTheDocument();
    });

    it("既選択カテゴリをクリックしても category_id が null にならない", async () => {
      const user = userEvent.setup();
      const category = makeCategory();
      const task = makeTask({ category_id: "cat-1" });
      const onUpdate = vi.fn();
      render(
        <TaskDetailModal
          {...defaultProps}
          task={task}
          categories={[category]}
          onUpdate={onUpdate}
        />
      );

      // 既選択のカテゴリボタンをクリック
      await user.click(screen.getByText("仕事"));
      // 保存
      await user.click(screen.getByText("保存"));

      expect(onUpdate).toHaveBeenCalledWith(
        "task-1",
        expect.objectContaining({ category_id: "cat-1" })
      );
    });
  });
});
