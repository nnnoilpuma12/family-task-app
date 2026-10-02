import { renderHook, act } from "@testing-library/react";
import { createQueryWrapperWithClient } from "@/test/query-wrapper";
import { queryKeys } from "@/lib/query-keys";
import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { useRealtimeTasks } from "@/hooks/use-realtime-tasks";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/types";

vi.mock("@/lib/supabase/client");
vi.mock("@/lib/idle", () => ({
  runWhenIdle: vi.fn((cb: () => void) => {
    cb();
    return vi.fn();
  }),
}));

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

/** subscribe() に渡す購読状態ハンドラ */
type SubscribeHandler = (status: REALTIME_SUBSCRIBE_STATES, err?: Error) => void;

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

  function renderWithState(
    householdId: string | null,
    initialTasks: Task[] = [],
    onRemoteChange?: () => void,
    onResync?: () => void
  ) {
    const { wrapper, queryClient } = createQueryWrapperWithClient();
    queryClient.setQueryData(queryKeys.tasks(householdId), initialTasks);
    return renderHook(() => {
      const [tasks, setTasks] = useState<Task[]>(initialTasks);
      useRealtimeTasks(householdId, setTasks, onRemoteChange, onResync);
      return { tasks };
    }, { wrapper });
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

  it("自分のINSERT echoと並び順・URL・期限だけのUPDATEではおすすめを再計算しない", () => {
    const task = makeTask({ id: "existing" });
    const changed = vi.fn();
    renderWithState(HOUSEHOLD_ID, [task], changed);
    act(() => { callbacks.INSERT({ new: task }); });
    act(() => { callbacks.UPDATE({ new: { ...task, sort_order: 20, url: "https://example.com", due_date: "2026-10-02" } }); });
    expect(changed).not.toHaveBeenCalled();
    act(() => { callbacks.UPDATE({ new: { ...task, is_done: true } }); });
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("各イベントで onRemoteChange が呼ばれる", () => {
    const onRemoteChange = vi.fn();
    const task = makeTask({ id: "t-1" });
    renderWithState(HOUSEHOLD_ID, [task], onRemoteChange);

    act(() => { callbacks.INSERT({ new: makeTask({ id: "t-99" }) }); });
    act(() => { callbacks.UPDATE({ new: { ...task, title: "変更済み" } }); });
    act(() => { callbacks.DELETE({ old: { id: "t-1" } }); });

    expect(onRemoteChange).toHaveBeenCalledTimes(3);
  });

  it("購読が成立したら onResync が呼ばれる（切断中の取りこぼしを取得で回収する）", () => {
    const onResync = vi.fn();
    renderWithState(HOUSEHOLD_ID, [], undefined, onResync);

    const handler: SubscribeHandler = mockChannel.subscribe.mock.calls[0][0];
    act(() => { handler(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED); });

    expect(onResync).toHaveBeenCalledTimes(1);
  });

  it("購読がエラーになっても onResync は呼ばれない", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onResync = vi.fn();
    renderWithState(HOUSEHOLD_ID, [], undefined, onResync);

    const handler: SubscribeHandler = mockChannel.subscribe.mock.calls[0][0];
    act(() => { handler(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR, new Error("boom")); });

    expect(onResync).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("再レンダーしてもチャンネルを張り直さない", () => {
    // 依存が毎レンダー変わると購読が切れ張り直しになり、その隙間のイベントを落とす。
    // page.tsx から渡す onResync（useQuery の refetch）は参照が安定している前提。
    const onRemoteChange = vi.fn();
    const onResync = vi.fn();
    const { rerender } = renderHook(
      ({ id }: { id: string }) => {
        const [tasks, setTasks] = useState<Task[]>([]);
        useRealtimeTasks(id, setTasks, onRemoteChange, onResync);
        return { tasks };
      },
      { initialProps: { id: HOUSEHOLD_ID }, wrapper: createQueryWrapperWithClient().wrapper }
    );

    rerender({ id: HOUSEHOLD_ID });
    rerender({ id: HOUSEHOLD_ID });

    expect(vi.mocked(createClient)().channel).toHaveBeenCalledTimes(1);
    expect(mockRemoveChannel).not.toHaveBeenCalled();
  });

  it("アンマウント時に removeChannel が呼ばれる", () => {
    const { unmount } = renderWithState(HOUSEHOLD_ID);
    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
  });
});
