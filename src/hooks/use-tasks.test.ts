import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTasks } from "@/hooks/use-tasks";
import { createClient } from "@/lib/supabase/client";
import { MockQueryChain, createMockSupabase } from "@/test/mocks/supabase";
import type { Task } from "@/types";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn() }));
vi.mock("@/lib/supabase/client");

const HOUSEHOLD_ID = "household-1";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(),
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

describe("useTasks", () => {
  let chain: MockQueryChain;
  let mockClient: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    chain = new MockQueryChain();
    mockClient = createMockSupabase(chain);
    vi.mocked(createClient).mockReturnValue(mockClient as ReturnType<typeof createClient>);
  });

  describe("fetchTasks", () => {
    it("タスクを取得してセットする", async () => {
      const task = makeTask();
      chain._result = { data: [task], error: null };

      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID));

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.tasks).toEqual([task]);
    });

    it("ソート順: is_done, sort_order, created_at DESC で order を呼ぶ", async () => {
      chain._result = { data: [], error: null };
      renderHook(() => useTasks(HOUSEHOLD_ID));

      await waitFor(() => expect(chain.order).toHaveBeenCalled());
      expect(chain.order).toHaveBeenNthCalledWith(1, "is_done");
      expect(chain.order).toHaveBeenNthCalledWith(2, "sort_order");
      expect(chain.order).toHaveBeenNthCalledWith(3, "created_at", { ascending: false });
    });
  });

  describe("addTask", () => {
    it("正常系: tasks にタスクを追加する", async () => {
      chain._result = { data: [], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID));
      await waitFor(() => expect(result.current.loading).toBe(false));

      const serverTask = makeTask({ title: "買い物" });
      chain.single.mockResolvedValueOnce({ data: serverTask, error: null });

      await act(async () => {
        await result.current.addTask({ title: "買い物" });
      });

      expect(result.current.tasks).toContainEqual(serverTask);
    });

    it("エラー時: optimistic update をロールバックする", async () => {
      chain._result = { data: [], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID));
      await waitFor(() => expect(result.current.loading).toBe(false));

      chain.single.mockResolvedValueOnce({ data: null, error: { message: "DB error" } });

      await act(async () => {
        await result.current.addTask({ title: "失敗タスク" });
      });

      expect(result.current.tasks).toHaveLength(0);
    });
  });

  describe("toggleTask", () => {
    it("未完了→完了: is_done=true, completed_at がセットされる", async () => {
      const task = makeTask({ id: "t-1", is_done: false, completed_at: null });
      chain._result = { data: [task], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID));
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      const updatedTask = makeTask({
        id: "t-1",
        is_done: true,
        completed_at: "2024-01-01T12:00:00Z",
      });
      chain.single.mockResolvedValueOnce({ data: updatedTask, error: null });

      await act(async () => {
        await result.current.toggleTask("t-1");
      });

      expect(result.current.tasks[0].is_done).toBe(true);
      expect(result.current.tasks[0].completed_at).not.toBeNull();
    });

    it("完了→未完了: is_done=false, completed_at=null", async () => {
      const task = makeTask({
        id: "t-1",
        is_done: true,
        completed_at: "2024-01-01T12:00:00Z",
      });
      chain._result = { data: [task], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID));
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      const updatedTask = makeTask({ id: "t-1", is_done: false, completed_at: null });
      chain.single.mockResolvedValueOnce({ data: updatedTask, error: null });

      await act(async () => {
        await result.current.toggleTask("t-1");
      });

      expect(result.current.tasks[0].is_done).toBe(false);
      expect(result.current.tasks[0].completed_at).toBeNull();
    });
  });

  describe("updateTask", () => {
    it("ホワイトリスト外のフィールドは update 呼び出しに含まれない", async () => {
      const task = makeTask({ id: "t-1" });
      chain._result = { data: [task], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID));
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      chain.single.mockResolvedValueOnce({ data: task, error: null });

      await act(async () => {
        await result.current.updateTask("t-1", {
          title: "新しいタイトル",
          household_id: "evil-household",
        });
      });

      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ title: "新しいタイトル" })
      );
      expect(chain.update).toHaveBeenCalledWith(
        expect.not.objectContaining({ household_id: "evil-household" })
      );
    });
  });

  describe("deleteTask", () => {
    it("正常系: tasks からタスクが削除される", async () => {
      const task = makeTask({ id: "t-1" });
      chain._result = { data: [task], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID));
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      await act(async () => {
        await result.current.deleteTask("t-1");
      });

      expect(result.current.tasks).toHaveLength(0);
    });
  });

  describe("reorderTasks", () => {
    it("reorder_tasks RPC が正しい引数で呼ばれる", async () => {
      chain._result = { data: [], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID));
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.reorderTasks(["id-b", "id-a"]);
      });

      expect(mockClient.rpc).toHaveBeenCalledWith("reorder_tasks", {
        p_task_ids: ["id-b", "id-a"],
        p_sort_orders: [0, 1],
      });
    });
  });
});
