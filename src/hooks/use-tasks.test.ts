import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { useTasks } from "@/hooks/use-tasks";
import { createClient } from "@/lib/supabase/client";
import { MockQueryChain, createMockSupabase } from "@/test/mocks/supabase";
import { createQueryWrapper } from "@/test/query-wrapper";
import { flushQueryUpdates } from "@/test/flush";
import type { Task } from "@/types";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
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
    // @ts-expect-error - モックオブジェクトは SupabaseClient の全インターフェースを実装しない
    vi.mocked(createClient).mockReturnValue(mockClient as ReturnType<typeof createClient>);
  });

  describe("fetchTasks", () => {
    it("タスクを取得してセットする", async () => {
      const task = makeTask();
      chain._result = { data: [task], error: null };

      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.tasks).toEqual([task]);
    });

    it("ソート順: is_done, sort_order, created_at DESC で order を呼ぶ", async () => {
      chain._result = { data: [], error: null };
      renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });

      await waitFor(() => expect(chain.order).toHaveBeenCalled());
      expect(chain.order).toHaveBeenNthCalledWith(1, "is_done");
      expect(chain.order).toHaveBeenNthCalledWith(2, "sort_order");
      expect(chain.order).toHaveBeenNthCalledWith(3, "created_at", { ascending: false });
    });

    it("完了済みは直近のみ: 未完了 OR 直近完了に絞る or フィルタを呼ぶ", async () => {
      chain._result = { data: [], error: null };
      renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });

      await waitFor(() => expect(chain.or).toHaveBeenCalled());
      expect(chain.or).toHaveBeenCalledWith(
        expect.stringMatching(/^is_done\.eq\.false,completed_at\.gte\./)
      );
    });
  });

  describe("addTask", () => {
    it("正常系: tasks にタスクを追加する", async () => {
      chain._result = { data: [], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));

      const serverTask = makeTask({ title: "買い物" });
      chain.single.mockResolvedValueOnce({ data: serverTask, error: null });

      await act(async () => {
        await result.current.addTask({ title: "買い物" });
      });
      await flushQueryUpdates();

      await waitFor(() => expect(result.current.tasks).toContainEqual(serverTask));
    });

    it("エラー時: optimistic update をロールバックする", async () => {
      chain._result = { data: [], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));

      chain.single.mockResolvedValueOnce({ data: null, error: { message: "DB error" } });

      await act(async () => {
        await result.current.addTask({ title: "失敗タスク" });
      });
      await flushQueryUpdates();

      expect(result.current.tasks).toHaveLength(0);
    });
  });

  describe("toggleTask", () => {
    it("未完了→完了: is_done=true, completed_at がセットされる", async () => {
      const task = makeTask({ id: "t-1", is_done: false, completed_at: null });
      chain._result = { data: [task], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
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
      await flushQueryUpdates();

      await waitFor(() => expect(result.current.tasks[0].is_done).toBe(true));
      expect(result.current.tasks[0].completed_at).not.toBeNull();
    });

    it("完了→未完了: is_done=false, completed_at=null", async () => {
      const task = makeTask({
        id: "t-1",
        is_done: true,
        completed_at: "2024-01-01T12:00:00Z",
      });
      chain._result = { data: [task], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      const updatedTask = makeTask({ id: "t-1", is_done: false, completed_at: null });
      chain.single.mockResolvedValueOnce({ data: updatedTask, error: null });

      await act(async () => {
        await result.current.toggleTask("t-1");
      });
      await flushQueryUpdates();

      await waitFor(() => expect(result.current.tasks[0].is_done).toBe(false));
      expect(result.current.tasks[0].completed_at).toBeNull();
    });
  });

  describe("updateTask", () => {
    it("ホワイトリスト外のフィールドは update 呼び出しに含まれない", async () => {
      const task = makeTask({ id: "t-1" });
      chain._result = { data: [task], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      chain.single.mockResolvedValueOnce({ data: task, error: null });

      await act(async () => {
        await result.current.updateTask("t-1", {
          title: "新しいタイトル",
          household_id: "evil-household",
        });
      });
      await flushQueryUpdates();

      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ title: "新しいタイトル" })
      );
      expect(chain.update).toHaveBeenCalledWith(
        expect.not.objectContaining({ household_id: "evil-household" })
      );
    });

    it("エラー時: snapshot にロールバックする", async () => {
      const task = makeTask({ id: "t-1", title: "元のタイトル" });
      chain._result = { data: [task], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      chain.single.mockResolvedValueOnce({ data: null, error: { message: "DB error" } });

      await act(async () => {
        await result.current.updateTask("t-1", { title: "新しいタイトル" });
      });
      await flushQueryUpdates();

      expect(result.current.tasks[0].title).toBe("元のタイトル");
    });

    it("更新成功時にプッシュ通知が送信される", async () => {
      const { sendPushNotification } = await import("@/lib/push");
      const task = makeTask({ id: "t-1", title: "掃除" });
      chain._result = { data: [task], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      const updatedTask = makeTask({ id: "t-1", title: "新しいタイトル" });
      chain.single.mockResolvedValueOnce({ data: updatedTask, error: null });

      await act(async () => {
        await result.current.updateTask("t-1", { title: "新しいタイトル" });
      });
      await flushQueryUpdates();

      expect(sendPushNotification).toHaveBeenCalledWith({
        title: "家族タスク",
        body: "「新しいタイトル」が更新されました",
        householdId: HOUSEHOLD_ID,
      });
    });

    it("skipNotification: true の場合は通知が送信されない", async () => {
      const { sendPushNotification } = await import("@/lib/push");
      vi.mocked(sendPushNotification).mockClear();
      const task = makeTask({ id: "t-1" });
      chain._result = { data: [task], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      chain.single.mockResolvedValueOnce({ data: task, error: null });

      await act(async () => {
        await result.current.updateTask("t-1", { is_done: true }, { skipNotification: true });
      });
      await flushQueryUpdates();

      expect(sendPushNotification).not.toHaveBeenCalled();
    });
  });

  describe("deleteTask", () => {
    it("正常系: tasks からタスクが削除される", async () => {
      const task = makeTask({ id: "t-1" });
      chain._result = { data: [task], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      await act(async () => {
        await result.current.deleteTask("t-1");
      });
      await flushQueryUpdates();

      await waitFor(() => expect(result.current.tasks).toHaveLength(0));
    });

    it("エラー時: 楽観的削除からロールバックする", async () => {
      const task = makeTask({ id: "t-1" });
      chain._result = { data: [task], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      chain._result = { data: null, error: { message: "DB error" } };

      await act(async () => {
        await result.current.deleteTask("t-1", { skipToast: true });
      });
      await flushQueryUpdates();

      await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    });
  });

  describe("reorderTasks", () => {
    it("reorder_tasks RPC が正しい引数で呼ばれる", async () => {
      chain._result = { data: [], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.reorderTasks(["id-b", "id-a"]);
      });
      await flushQueryUpdates();

      expect(mockClient.rpc).toHaveBeenCalledWith("reorder_tasks", {
        p_task_ids: ["id-b", "id-a"],
        p_sort_orders: [0, 1],
      });
    });

    it("エラー時: snapshot にロールバックする", async () => {
      const tasks = [
        makeTask({ id: "t-1", sort_order: 0 }),
        makeTask({ id: "t-2", sort_order: 1 }),
      ];
      chain._result = { data: tasks, error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.tasks).toHaveLength(2));

      mockClient.rpc.mockResolvedValueOnce({ data: null, error: { message: "RPC error" } });

      await act(async () => {
        await result.current.reorderTasks(["t-2", "t-1"]);
      });
      await flushQueryUpdates();

      expect(result.current.tasks.map((t) => t.id)).toEqual(["t-1", "t-2"]);
    });
  });

  describe("deleteTask の「元に戻す」", () => {
    // sonner の action は ReactNode も取りうるので型ガードで絞る
    function isUndoAction(value: unknown): value is { label: string; onClick: () => void } {
      if (typeof value !== "object" || value === null) return false;
      if (!("label" in value) || !("onClick" in value)) return false;
      return typeof value.onClick === "function";
    }

    function latestUndoAction() {
      const calls = vi.mocked(toast).mock.calls;
      const options = calls[calls.length - 1]?.[1];
      const action = options?.action;
      if (!isUndoAction(action)) {
        throw new Error("「元に戻す」アクションが見つかりません");
      }
      return action;
    }

    async function renderAndDelete(task: Task) {
      chain._result = { data: [task], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      chain._result = { data: null, error: null };
      await act(async () => {
        await result.current.deleteTask(task.id);
      });
      await flushQueryUpdates();
      return result;
    }

    it("削除成功時に「元に戻す」付きトーストを出す", async () => {
      await renderAndDelete(makeTask({ id: "t-1", title: "牛乳を買う" }));

      expect(toast).toHaveBeenCalledWith(
        "タスクを削除しました",
        expect.objectContaining({
          action: expect.objectContaining({ label: "元に戻す" }),
        })
      );
    });

    it("「元に戻す」を押すと削除したタスクを insert して一覧へ戻す", async () => {
      const task = makeTask({ id: "t-1", title: "牛乳を買う" });
      const result = await renderAndDelete(task);
      expect(result.current.tasks).toHaveLength(0);

      await act(async () => {
        latestUndoAction().onClick();
      });
      await flushQueryUpdates();

      expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ id: "t-1" }));
      expect(result.current.tasks.map((t) => t.id)).toEqual(["t-1"]);
    });

    it("復元に失敗したらエラートーストを出し一覧を戻さない", async () => {
      const result = await renderAndDelete(makeTask({ id: "t-1" }));

      chain._result = { data: null, error: { message: "insert failed" } };
      await act(async () => {
        latestUndoAction().onClick();
      });
      await flushQueryUpdates();

      expect(toast.error).toHaveBeenCalledWith("元に戻せませんでした");
      expect(result.current.tasks).toHaveLength(0);
    });

    it("skipToast: true ではトーストを出さない", async () => {
      const task = makeTask({ id: "t-1" });
      chain._result = { data: [task], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      chain._result = { data: null, error: null };
      await act(async () => {
        await result.current.deleteTask("t-1", { skipToast: true });
      });
      await flushQueryUpdates();

      expect(toast).not.toHaveBeenCalled();
    });
  });

  describe("loadMoreCompleted", () => {
    it("取得した古い完了済みタスクをキャッシュ末尾に追記する", async () => {
      const recent = makeTask({
        id: "recent",
        is_done: true,
        completed_at: "2024-02-01T00:00:00Z",
      });
      chain._result = { data: [recent], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      const older = makeTask({
        id: "older",
        is_done: true,
        completed_at: "2023-12-01T00:00:00Z",
      });
      chain._result = { data: [older], error: null };

      await act(async () => {
        await result.current.loadMoreCompleted();
      });
      await flushQueryUpdates();

      await waitFor(() => expect(result.current.tasks).toHaveLength(2));
      // 古いタスクは末尾に追記される
      expect(result.current.tasks[1].id).toBe("older");
    });

    it("最古の completed_at をカーソルに lt で絞り込む", async () => {
      const recent = makeTask({
        id: "recent",
        is_done: true,
        completed_at: "2024-02-01T00:00:00Z",
      });
      chain._result = { data: [recent], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      chain._result = { data: [], error: null };

      await act(async () => {
        await result.current.loadMoreCompleted();
      });
      await flushQueryUpdates();

      expect(chain.lt).toHaveBeenCalledWith("completed_at", "2024-02-01T00:00:00Z");
    });

    it("ページサイズ未満の取得で hasMoreCompleted が false になる", async () => {
      chain._result = { data: [], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.hasMoreCompleted).toBe(true);

      await act(async () => {
        await result.current.loadMoreCompleted();
      });
      await flushQueryUpdates();

      expect(result.current.hasMoreCompleted).toBe(false);
    });

    it("ページサイズぴったり30件の取得で hasMoreCompleted が true のまま", async () => {
      chain._result = { data: [], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.hasMoreCompleted).toBe(true);

      const batch30 = Array.from({ length: 30 }, (_, i) =>
        makeTask({
          id: `batch-${i}`,
          is_done: true,
          completed_at: `2023-${String(i + 1).padStart(2, "0")}-01T00:00:00Z`,
        })
      );
      chain._result = { data: batch30, error: null };

      await act(async () => {
        await result.current.loadMoreCompleted();
      });
      await flushQueryUpdates();

      expect(result.current.hasMoreCompleted).toBe(true);
    });

    it("重複 id は追記されない", async () => {
      const dup = makeTask({
        id: "dup",
        is_done: true,
        completed_at: "2024-02-01T00:00:00Z",
      });
      chain._result = { data: [dup], error: null };
      const { result } = renderHook(() => useTasks(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      // 同じ id を返しても二重に追加されない
      chain._result = { data: [dup], error: null };

      await act(async () => {
        await result.current.loadMoreCompleted();
      });
      await flushQueryUpdates();

      expect(result.current.tasks).toHaveLength(1);
    });
  });
});
