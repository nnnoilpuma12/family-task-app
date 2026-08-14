import { renderHook, act } from "@testing-library/react";
import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRealtimeTasks } from "@/hooks/use-realtime-tasks";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/types";

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

/** postgres_changes のコールバックが受け取るペイロード */
type RealtimeCallback = (payload: { new?: Partial<Task>; old?: Partial<Task> }) => void;

describe("useRealtimeTasks", () => {
  // postgres_changes イベントのコールバックを捕捉するためのマップ
  let callbacks: Record<string, RealtimeCallback>;
  let mockChannel: { on: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> };
  let mockRemoveChannel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    callbacks = {};
    mockChannel = {
      on: vi.fn().mockImplementation(
        (_type: string, filter: { event: string }, cb: RealtimeCallback) => {
          callbacks[filter.event] = cb;
          return mockChannel;
        }
      ),
      subscribe: vi.fn().mockImplementation(() => mockChannel),
    };
    mockRemoveChannel = vi.fn();
    // @ts-expect-error - モックオブジェクトは SupabaseClient の全インターフェースを実装しない
    vi.mocked(createClient).mockReturnValue({
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: mockRemoveChannel,
    });
  });

  function renderWithState(householdId: string | null, initialTasks: Task[] = [], onRemoteChange?: () => void) {
    return renderHook(() => {
      const [tasks, setTasks] = useState<Task[]>(initialTasks);
      useRealtimeTasks(householdId, setTasks, onRemoteChange);
      return { tasks };
    });
  }

  it("householdId がない場合はチャンネルを作成しない", () => {
    renderWithState(null);
    expect(vi.mocked(createClient)).not.toHaveBeenCalled();
  });

  it("householdId があればチャンネルを作成して購読する", () => {
    renderWithState(HOUSEHOLD_ID);
    const channel = vi.mocked(createClient)().channel;
    expect(channel).toHaveBeenCalledWith(`tasks:${HOUSEHOLD_ID}`);
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it("INSERT: 新しいタスクが state に追加される", () => {
    const existing = makeTask({ id: "t-1" });
    const { result } = renderWithState(HOUSEHOLD_ID, [existing]);

    const newTask = makeTask({ id: "t-2" });
    act(() => {
      callbacks.INSERT({ new: newTask });
    });

    expect(result.current.tasks).toHaveLength(2);
    expect(result.current.tasks.some((t) => t.id === "t-2")).toBe(true);
  });

  it("INSERT: 同じ id のタスクは重複追加されない（楽観的更新との競合防止）", () => {
    const existing = makeTask({ id: "t-1" });
    const { result } = renderWithState(HOUSEHOLD_ID, [existing]);

    act(() => {
      callbacks.INSERT({ new: existing });
    });

    expect(result.current.tasks).toHaveLength(1);
  });

  it("UPDATE: 既存タスクの内容が更新される", () => {
    const task = makeTask({ id: "t-1", title: "旧タイトル" });
    const { result } = renderWithState(HOUSEHOLD_ID, [task]);

    const updated = { ...task, title: "新タイトル" };
    act(() => {
      callbacks.UPDATE({ new: updated });
    });

    expect(result.current.tasks[0].title).toBe("新タイトル");
  });

  it("DELETE: 指定した id のタスクが削除される", () => {
    const t1 = makeTask({ id: "t-1" });
    const t2 = makeTask({ id: "t-2" });
    const { result } = renderWithState(HOUSEHOLD_ID, [t1, t2]);

    act(() => {
      callbacks.DELETE({ old: { id: "t-1" } });
    });

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].id).toBe("t-2");
  });

  it("各イベントで onRemoteChange が呼ばれる", () => {
    const onRemoteChange = vi.fn();
    const task = makeTask({ id: "t-1" });
    renderWithState(HOUSEHOLD_ID, [task], onRemoteChange);

    act(() => { callbacks.INSERT({ new: makeTask({ id: "t-99" }) }); });
    act(() => { callbacks.UPDATE({ new: task }); });
    act(() => { callbacks.DELETE({ old: { id: "t-1" } }); });

    expect(onRemoteChange).toHaveBeenCalledTimes(3);
  });

  it("アンマウント時に removeChannel が呼ばれる", () => {
    const { unmount } = renderWithState(HOUSEHOLD_ID);
    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
  });
});
