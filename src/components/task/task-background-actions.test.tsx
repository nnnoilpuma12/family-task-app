import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { TaskCreateSheet } from "@/components/task/task-create-sheet";
import { TaskDetailModal } from "@/components/task/task-detail-modal";
import type { Task } from "@/types";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/components/ui/bottom-sheet", () => ({ BottomSheet: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) => isOpen ? <div role="dialog">{children}</div> : null }));
vi.mock("@/components/ui/modal", () => ({ Modal: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) => isOpen ? <div role="dialog">{children}</div> : null }));

function restoreLatest() {
  const action = vi.mocked(toast.error).mock.calls.at(-1)?.[1]?.action;
  if (typeof action !== "object" || action === null || !("onClick" in action)) throw new Error("復元アクションがありません");
  // 実際のクリックを通す（sonner の MouseEvent 契約を保つ）。
  render(<button onClick={action.onClick}>復元する</button>);
  fireEvent.click(screen.getByText("復元する"));
}

const task: Task = {
  id: "task", household_id: "household", title: "変更前", category_id: null,
  is_done: false, sort_order: 0, due_date: null, completed_at: null,
  memo: null, url: null, created_by: null,
  created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z",
};

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

describe("通信を待たないタスクフォーム", () => {
  it("追加は500msの応答を待たず閉じ、失敗した元の入力を後から復元できる", async () => {
    const submit = vi.fn(() => new Promise<{ error: string }>((resolve) => setTimeout(() => resolve({ error: "offline" }), 500)));
    function Form() {
      const [open, setOpen] = useState(true);
      return <><button onClick={() => setOpen(true)}>新しく追加</button><TaskCreateSheet isOpen={open} onClose={() => setOpen(false)} onReopen={() => setOpen(true)} categories={[]} selectedCategoryId={null} onSubmit={submit} /></>;
    }
    render(<Form />);
    fireEvent.change(screen.getByPlaceholderText("タスク名を入力"), { target: { value: "牛乳" } });
    fireEvent.change(screen.getByPlaceholderText("メモ（任意）"), { target: { value: "2本" } });
    fireEvent.click(screen.getByRole("button", { name: "追加" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
    // 失敗通知が別の入力を強制的に上書きしない。
    fireEvent.click(screen.getByText("新しく追加"));
    fireEvent.change(screen.getByPlaceholderText("タスク名を入力"), { target: { value: "卵" } });
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(screen.getByPlaceholderText("タスク名を入力")).toHaveValue("卵");
    restoreLatest();
    expect(screen.getByPlaceholderText("タスク名を入力")).toHaveValue("牛乳");
    expect(screen.getByPlaceholderText("メモ（任意）")).toHaveValue("2本");
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it.each(["保存", "タスクを削除"])("%s は応答前に閉じ、例外でも復元できる", async (button) => {
    const write = vi.fn(() => new Promise<void>((_, reject) => setTimeout(() => reject(new Error("offline")), 500)));
    function Form() {
      const [selected, setSelected] = useState<Task | null>(task);
      return <TaskDetailModal task={selected} isOpen={!!selected} onClose={() => setSelected(null)} onRestore={setSelected} categories={[]} members={[]} onUpdate={write} onDelete={write} />;
    }
    render(<Form />);
    fireEvent.change(screen.getByDisplayValue("変更前"), { target: { value: "変更後" } });
    fireEvent.click(screen.getByRole("button", { name: button }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(500));
    restoreLatest();
    expect(screen.getByDisplayValue(button === "保存" ? "変更後" : "変更前")).toBeInTheDocument();
    expect(write).toHaveBeenCalledTimes(1);
  });
});
