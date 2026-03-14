import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TaskDetailModal } from "@/components/task/task-detail-modal";
import type { Task, Category, Profile } from "@/types";

// framer-motion は jsdom でアニメーションが動作しないためモック
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      initial: _i,
      animate: _a,
      exit: _e,
      transition: _t,
      drag: _d,
      dragConstraints: _dc,
      dragElastic: _de,
      onDragEnd: _ode,
      ...props
    }: React.ComponentProps<"div"> & Record<string, unknown>) => (
      <div {...props}>{children}</div>
    ),
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
  categories: [] as Category[],
  members: [] as Profile[],
  onUpdate: vi.fn(),
  onDelete: vi.fn(),
};

describe("TaskDetailModal", () => {
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
