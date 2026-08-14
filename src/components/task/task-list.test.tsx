import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import { TaskList } from "@/components/task/task-list";
import type { Task, Category, Profile } from "@/types";

/** DndContext に渡された onDragEnd を掴んで並び替えを再現する */
const dndState = vi.hoisted(() => ({
  onDragEnd: null as ((event: DragEndEvent) => void) | null,
}));

const confetti = vi.hoisted(() => vi.fn());

vi.mock("canvas-confetti", () => ({ default: confetti }));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: { children?: ReactNode }) => <div {...props}>{children}</div>,
  },
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: ReactNode;
    onDragEnd: (event: DragEndEvent) => void;
  }) => {
    dndState.onDragEnd = onDragEnd;
    return <div>{children}</div>;
  },
  DragOverlay: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PointerSensor: class PointerSensor {},
  TouchSensor: class TouchSensor {},
  closestCenter: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/sortable")>();
  return {
    // arrayMove は handleDragEnd の実ロジックなので本物を使う
    arrayMove: actual.arrayMove,
    verticalListSortingStrategy: actual.verticalListSortingStrategy,
    SortableContext: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

// TaskList 自身の責務（振り分け・件数・ボタン）に絞るため子は差し替える
vi.mock("@/components/task/task-item", () => ({
  TaskItem: ({
    task,
    onToggle,
  }: {
    task: Task;
    onToggle: (id: string) => void;
  }) => (
    <div data-testid={`task-${task.id}`} data-done={String(task.is_done)}>
      <span>{task.title}</span>
      <button type="button" onClick={() => onToggle(task.id)}>
        {`toggle:${task.title}`}
      </button>
    </div>
  ),
}));

const HOUSEHOLD_ID = "household-1";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t-1",
    title: "タスク",
    category_id: null,
    due_date: null,
    memo: null,
    url: null,
    created_by: null,
    household_id: HOUSEHOLD_ID,
    is_done: false,
    sort_order: 0,
    completed_at: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

type Handlers = {
  onToggle: ReturnType<typeof vi.fn>;
  onTap: ReturnType<typeof vi.fn>;
  onDelete: ReturnType<typeof vi.fn>;
  onReorder: ReturnType<typeof vi.fn>;
  onDeleteAllDone: ReturnType<typeof vi.fn>;
  onLoadMoreCompleted: ReturnType<typeof vi.fn>;
};

function renderList(
  tasks: Task[],
  extra: { hasMoreCompleted?: boolean; loadingMoreCompleted?: boolean; withLoadMore?: boolean } = {}
) {
  const handlers: Handlers = {
    onToggle: vi.fn(),
    onTap: vi.fn(),
    onDelete: vi.fn(),
    onReorder: vi.fn(),
    onDeleteAllDone: vi.fn(),
    onLoadMoreCompleted: vi.fn(),
  };
  const categories: Category[] = [];
  const members: Profile[] = [];
  const view = render(
    <TaskList
      tasks={tasks}
      categories={categories}
      members={members}
      onToggle={handlers.onToggle}
      onTap={handlers.onTap}
      onDelete={handlers.onDelete}
      onReorder={handlers.onReorder}
      onDeleteAllDone={handlers.onDeleteAllDone}
      onLoadMoreCompleted={extra.withLoadMore === false ? undefined : handlers.onLoadMoreCompleted}
      hasMoreCompleted={extra.hasMoreCompleted}
      loadingMoreCompleted={extra.loadingMoreCompleted}
    />
  );
  return { ...view, ...handlers };
}

describe("TaskList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dndState.onDragEnd = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("空状態", () => {
    it("タスクが 0 件なら空メッセージを出す", () => {
      renderList([]);

      expect(screen.getByText("タスクがありません")).toBeInTheDocument();
      expect(screen.queryByText("すべて削除")).not.toBeInTheDocument();
    });
  });

  describe("未完了と完了の振り分け", () => {
    it("完了済みは完了セクションに件数付きで出す", () => {
      renderList([
        makeTask({ id: "t-1", title: "未完了A" }),
        makeTask({ id: "t-2", title: "完了A", is_done: true }),
        makeTask({ id: "t-3", title: "完了B", is_done: true }),
      ]);

      expect(screen.getByText("完了 (2)")).toBeInTheDocument();
      expect(screen.getByTestId("task-t-1")).toHaveAttribute("data-done", "false");
      expect(screen.getByTestId("task-t-2")).toHaveAttribute("data-done", "true");
    });

    it("完了済みが無ければ完了セクションを出さない", () => {
      renderList([makeTask({ id: "t-1" })]);

      expect(screen.queryByText(/^完了 \(/)).not.toBeInTheDocument();
      expect(screen.queryByText("すべて削除")).not.toBeInTheDocument();
    });
  });

  describe("完了へのトグル", () => {
    it("未完了→完了では 300ms 完了スタイルを見せてから完了セクションへ移す", () => {
      // userEvent は fake timers と噛み合わせづらいので fireEvent を使う
      vi.useFakeTimers();
      const onToggle = vi.fn();
      const props = {
        categories: [],
        members: [],
        onToggle,
        onTap: vi.fn(),
        onDelete: vi.fn(),
        onReorder: vi.fn(),
        onDeleteAllDone: vi.fn(),
      };
      const { rerender } = render(
        <TaskList tasks={[makeTask({ id: "t-1", title: "牛乳" })]} {...props} />
      );

      fireEvent.click(screen.getByRole("button", { name: "toggle:牛乳" }));
      expect(onToggle).toHaveBeenCalledWith("t-1");

      // 親が完了状態を反映しても、300ms 経つまでは未完了リストに留まる
      rerender(
        <TaskList tasks={[makeTask({ id: "t-1", title: "牛乳", is_done: true })]} {...props} />
      );
      expect(screen.queryByText(/^完了 \(/)).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(299);
      });
      expect(screen.queryByText(/^完了 \(/)).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.getByText("完了 (1)")).toBeInTheDocument();
    });

    it("完了→未完了は保留せず即座に onToggle を呼ぶ", async () => {
      const user = userEvent.setup();
      const { onToggle } = renderList([makeTask({ id: "t-1", title: "牛乳", is_done: true })]);

      await user.click(screen.getByRole("button", { name: "toggle:牛乳" }));

      expect(onToggle).toHaveBeenCalledWith("t-1");
      // 保留対象にならないので完了セクションに残ったまま
      expect(screen.getByText("完了 (1)")).toBeInTheDocument();
    });
  });

  describe("完了済みの一括削除", () => {
    it("確認ダイアログで承認すると onDeleteAllDone を呼ぶ", async () => {
      const user = userEvent.setup();
      const { onDeleteAllDone } = renderList([
        makeTask({ id: "t-1", is_done: true }),
        makeTask({ id: "t-2", is_done: true }),
      ]);

      await user.click(screen.getByRole("button", { name: /すべて削除/ }));

      expect(await screen.findByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/2件の完了済みタスクを削除します/)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "削除する" }));

      expect(onDeleteAllDone).toHaveBeenCalledTimes(1);
    });

    it("確認前は onDeleteAllDone を呼ばない", async () => {
      const user = userEvent.setup();
      const { onDeleteAllDone } = renderList([makeTask({ id: "t-1", is_done: true })]);

      await user.click(screen.getByRole("button", { name: /すべて削除/ }));

      expect(onDeleteAllDone).not.toHaveBeenCalled();
    });
  });

  describe("完了済みの追加読み込み", () => {
    it("hasMoreCompleted なら追加読み込みボタンを出す", () => {
      renderList([makeTask({ id: "t-1", is_done: true })], { hasMoreCompleted: true });

      expect(screen.getByRole("button", { name: "完了済みをもっと見る" })).toBeInTheDocument();
    });

    it("hasMoreCompleted が false なら出さない", () => {
      renderList([makeTask({ id: "t-1", is_done: true })], { hasMoreCompleted: false });

      expect(screen.queryByRole("button", { name: "完了済みをもっと見る" })).not.toBeInTheDocument();
    });

    it("onLoadMoreCompleted が無ければ出さない", () => {
      renderList([makeTask({ id: "t-1", is_done: true })], {
        hasMoreCompleted: true,
        withLoadMore: false,
      });

      expect(screen.queryByRole("button", { name: "完了済みをもっと見る" })).not.toBeInTheDocument();
    });

    it("押すと onLoadMoreCompleted を呼ぶ", async () => {
      const user = userEvent.setup();
      const { onLoadMoreCompleted } = renderList([makeTask({ id: "t-1", is_done: true })], {
        hasMoreCompleted: true,
      });

      await user.click(screen.getByRole("button", { name: "完了済みをもっと見る" }));

      expect(onLoadMoreCompleted).toHaveBeenCalledTimes(1);
    });

    it("読み込み中は文言を変えて押せなくする", () => {
      renderList([makeTask({ id: "t-1", is_done: true })], {
        hasMoreCompleted: true,
        loadingMoreCompleted: true,
      });

      expect(screen.getByRole("button", { name: "読み込み中..." })).toBeDisabled();
    });
  });

  describe("並び替え", () => {
    it("ドラッグ完了で並び替え後の id 配列を onReorder に渡す", () => {
      const { onReorder } = renderList([
        makeTask({ id: "t-1", title: "A" }),
        makeTask({ id: "t-2", title: "B" }),
        makeTask({ id: "t-3", title: "C" }),
      ]);

      act(() => {
        dndState.onDragEnd?.({
          active: { id: "t-3" },
          over: { id: "t-1" },
        } as DragEndEvent);
      });

      expect(onReorder).toHaveBeenCalledWith(["t-3", "t-1", "t-2"]);
    });

    it("同じ位置に落としたら onReorder を呼ばない", () => {
      const { onReorder } = renderList([
        makeTask({ id: "t-1", title: "A" }),
        makeTask({ id: "t-2", title: "B" }),
      ]);

      act(() => {
        dndState.onDragEnd?.({ active: { id: "t-1" }, over: { id: "t-1" } } as DragEndEvent);
      });

      expect(onReorder).not.toHaveBeenCalled();
    });

    it("リスト外に落としたら onReorder を呼ばない", () => {
      const { onReorder } = renderList([makeTask({ id: "t-1" })]);

      act(() => {
        dndState.onDragEnd?.({ active: { id: "t-1" }, over: null } as DragEndEvent);
      });

      expect(onReorder).not.toHaveBeenCalled();
    });
  });

  describe("全完了の紙吹雪", () => {
    it("全タスクが完了したら confetti を出す", async () => {
      renderList([
        makeTask({ id: "t-1", is_done: true }),
        makeTask({ id: "t-2", is_done: true }),
      ]);

      await vi.waitFor(() => expect(confetti).toHaveBeenCalled());
    });

    it("未完了が残っていれば出さない", async () => {
      renderList([
        makeTask({ id: "t-1", is_done: true }),
        makeTask({ id: "t-2", is_done: false }),
      ]);

      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(confetti).not.toHaveBeenCalled();
    });
  });
});
