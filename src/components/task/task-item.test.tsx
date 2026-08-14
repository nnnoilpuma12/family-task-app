import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { TaskItem } from "@/components/task/task-item";
import type { Task, Category, Profile } from "@/types";

/** motion.div の onDragEnd を掴んでスワイプ削除を再現するための受け皿 */
const motionState = vi.hoisted(() => ({
  onDragEnd: null as ((event: unknown, info: { offset: { x: number } }) => void) | null,
}));

vi.mock("framer-motion", () => {
  const MOTION_PROPS = [
    "initial", "animate", "exit", "transition", "whileTap", "whileHover",
    "drag", "dragConstraints", "dragElastic", "onDragEnd", "style",
  ];
  function makeMotionComponent(tag: string) {
    return function MotionComponent(props: Record<string, unknown> & { children?: ReactNode }) {
      if (typeof props.onDragEnd === "function") {
        motionState.onDragEnd = props.onDragEnd as typeof motionState.onDragEnd;
      }
      const domProps: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(props)) {
        if (key !== "children" && !MOTION_PROPS.includes(key)) domProps[key] = value;
      }
      return createElement(tag, domProps, props.children);
    };
  }
  return {
    motion: { div: makeMotionComponent("div"), span: makeMotionComponent("span") },
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    useMotionValue: () => ({ get: () => 0, set: vi.fn(), on: vi.fn() }),
    useTransform: () => ({ get: () => 0, set: vi.fn(), on: vi.fn() }),
  };
});

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

const HOUSEHOLD_ID = "household-1";
const TODAY = new Date("2026-08-07T09:00:00Z");

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t-1",
    title: "牛乳を買う",
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

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "user-1",
    household_id: HOUSEHOLD_ID,
    nickname: "たろう",
    avatar_url: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

type RenderOptions = {
  task?: Task;
  category?: Category | null;
  createdBy?: Profile | null;
  sortable?: boolean;
  isOverlay?: boolean;
};

function renderItem({ task = makeTask(), createdBy = null, category = null, sortable, isOverlay }: RenderOptions = {}) {
  const onToggle = vi.fn();
  const onTap = vi.fn();
  const onDelete = vi.fn();
  const view = render(
    <TaskItem
      task={task}
      category={category}
      createdBy={createdBy}
      onToggle={onToggle}
      onTap={onTap}
      onDelete={onDelete}
      isDragging={false}
      sortable={sortable}
      isOverlay={isOverlay}
    />
  );
  return { ...view, onToggle, onTap, onDelete, task };
}

describe("TaskItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    motionState.onDragEnd = null;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("表示", () => {
    it("タイトルを表示する", () => {
      renderItem({ task: makeTask({ title: "洗剤を買う" }) });

      expect(screen.getByText("洗剤を買う")).toBeInTheDocument();
    });

    it("完了済みは取り消し線で表示する", () => {
      renderItem({ task: makeTask({ is_done: true }) });

      expect(screen.getByText("牛乳を買う")).toHaveClass("line-through");
    });

    it("未完了は取り消し線を付けない", () => {
      renderItem({ task: makeTask({ is_done: false }) });

      expect(screen.getByText("牛乳を買う")).not.toHaveClass("line-through");
    });

    it("作成者のニックネームを表示する", () => {
      renderItem({ createdBy: makeProfile({ nickname: "はなこ" }) });

      expect(screen.getByText("はなこ")).toBeInTheDocument();
    });

    it("作成者が無ければニックネーム欄を出さない", () => {
      renderItem({ createdBy: null });

      expect(screen.queryByText("たろう")).not.toBeInTheDocument();
    });
  });

  describe("操作", () => {
    it("チェックボックスを押すと onToggle を呼ぶ", async () => {
      const user = userEvent.setup();
      const { onToggle, onTap } = renderItem({ task: makeTask({ id: "t-9" }) });

      await user.click(screen.getAllByRole("button")[0]);

      expect(onToggle).toHaveBeenCalledWith("t-9");
      // stopPropagation でカードのタップは発火しない
      expect(onTap).not.toHaveBeenCalled();
    });

    it("カードを押すと onTap を呼ぶ", async () => {
      const user = userEvent.setup();
      const { onTap, onToggle, task } = renderItem();

      await user.click(screen.getByText("牛乳を買う"));

      expect(onTap).toHaveBeenCalledWith(task);
      expect(onToggle).not.toHaveBeenCalled();
    });
  });

  describe("並び替えハンドル", () => {
    it("sortable のときだけ表示する", () => {
      const { container: withHandle } = render(
        <TaskItem
          task={makeTask()} category={null} createdBy={null}
          onToggle={vi.fn()} onTap={vi.fn()} onDelete={vi.fn()}
          isDragging={false} sortable
        />
      );
      expect(withHandle.querySelector(".cursor-grab")).not.toBeNull();

      const { container: withoutHandle } = render(
        <TaskItem
          task={makeTask()} category={null} createdBy={null}
          onToggle={vi.fn()} onTap={vi.fn()} onDelete={vi.fn()}
          isDragging={false} sortable={false}
        />
      );
      expect(withoutHandle.querySelector(".cursor-grab")).toBeNull();
    });
  });

  describe("期限の緊急度", () => {
    it("期限切れは danger の左ボーダーを付ける", () => {
      const { container } = renderItem({ task: makeTask({ due_date: "2026-08-05" }) });

      expect(container.querySelector(".border-l-danger")).not.toBeNull();
    });

    it("今日が期限なら warning の左ボーダーと ! を付ける", () => {
      const { container } = renderItem({ task: makeTask({ due_date: "2026-08-07" }) });

      expect(container.querySelector(".border-l-warning")).not.toBeNull();
      expect(screen.getByText("!")).toBeInTheDocument();
    });

    it("明日が期限なら caution の左ボーダーを付ける", () => {
      const { container } = renderItem({ task: makeTask({ due_date: "2026-08-08" }) });

      expect(container.querySelector(".border-l-caution")).not.toBeNull();
    });

    it("十分先の期限では緊急度の色を付けない", () => {
      const { container } = renderItem({ task: makeTask({ due_date: "2026-09-30" }) });

      expect(container.querySelector(".border-l-danger")).toBeNull();
      expect(container.querySelector(".border-l-warning")).toBeNull();
      expect(container.querySelector(".border-l-caution")).toBeNull();
    });

    it("完了済みなら期限切れでも緊急度の色を付けない", () => {
      const { container } = renderItem({
        task: makeTask({ due_date: "2026-08-05", is_done: true }),
      });

      expect(container.querySelector(".border-l-danger")).toBeNull();
    });
  });

  describe("スワイプ削除（完了済みのみ）", () => {
    it("左に 60px 超スワイプすると onDelete を呼ぶ", () => {
      const { onDelete } = renderItem({ task: makeTask({ id: "t-5", is_done: true }) });

      expect(motionState.onDragEnd).not.toBeNull();
      motionState.onDragEnd?.(null, { offset: { x: -80 } });

      expect(onDelete).toHaveBeenCalledWith("t-5");
    });

    it("スワイプが浅ければ削除しない", () => {
      const { onDelete } = renderItem({ task: makeTask({ is_done: true }) });

      motionState.onDragEnd?.(null, { offset: { x: -30 } });

      expect(onDelete).not.toHaveBeenCalled();
    });

    it("未完了タスクにはスワイプ削除を付けない", () => {
      renderItem({ task: makeTask({ is_done: false }) });

      expect(motionState.onDragEnd).toBeNull();
    });

    it("ドラッグ中のオーバーレイ表示にはスワイプ削除を付けない", () => {
      renderItem({ task: makeTask({ is_done: true }), isOverlay: true });

      expect(motionState.onDragEnd).toBeNull();
    });
  });
});
