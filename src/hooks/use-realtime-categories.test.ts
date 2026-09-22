import { renderHook, act } from "@testing-library/react";
import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { useRealtimeCategories } from "@/hooks/use-realtime-categories";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/types";

vi.mock("@/lib/supabase/client");
vi.mock("@/lib/idle", () => ({
  runWhenIdle: vi.fn((cb: () => void) => {
    cb();
    return vi.fn();
  }),
}));

const HOUSEHOLD_ID = "household-1";

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: crypto.randomUUID(),
    household_id: HOUSEHOLD_ID,
    name: "買い物",
    color: "#ff0000",
    icon: null,
    sort_order: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

/** postgres_changes のコールバックが受け取るペイロード */
type RealtimeCallback = (payload: {
  new?: Partial<Category>;
  old?: Partial<Category>;
}) => void;

type SubscribeHandler = (
  status: REALTIME_SUBSCRIBE_STATES,
  err?: Error
) => void;

describe("useRealtimeCategories", () => {
  let callbacks: Record<string, RealtimeCallback>;
  let mockChannel: {
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  };
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
    initial: Category[] = [],
    onResync?: () => void
  ) {
    return renderHook(() => {
      const [categories, setCategories] = useState<Category[]>(initial);
      useRealtimeCategories(householdId, setCategories, onResync);
      return { categories };
    });
  }

  it("householdId がない場合はチャンネルを作成しない", () => {
    renderWithState(null);
    expect(vi.mocked(createClient)).not.toHaveBeenCalled();
  });

  it("householdId があればチャンネルを作成して購読する", () => {
    renderWithState(HOUSEHOLD_ID);
    const channel = vi.mocked(createClient)().channel;
    expect(channel).toHaveBeenCalledWith(`categories:${HOUSEHOLD_ID}`);
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it("INSERT: 新しいカテゴリが sort_order 順に挿入される", () => {
    const first = makeCategory({ id: "c-1", name: "買い物", sort_order: 0 });
    const third = makeCategory({ id: "c-3", name: "掃除", sort_order: 2 });
    const { result } = renderWithState(HOUSEHOLD_ID, [first, third]);

    act(() => {
      callbacks.INSERT({
        new: makeCategory({ id: "c-2", name: "料理", sort_order: 1 }),
      });
    });

    expect(result.current.categories.map((c) => c.id)).toEqual([
      "c-1",
      "c-2",
      "c-3",
    ]);
  });

  it("INSERT: 同じ id のカテゴリは重複追加されない（楽観的更新との競合防止）", () => {
    const existing = makeCategory({ id: "c-1" });
    const { result } = renderWithState(HOUSEHOLD_ID, [existing]);

    act(() => {
      callbacks.INSERT({ new: existing });
    });

    expect(result.current.categories).toHaveLength(1);
  });

  it("UPDATE: 既存カテゴリの内容が更新される", () => {
    const category = makeCategory({ id: "c-1", name: "旧名" });
    const { result } = renderWithState(HOUSEHOLD_ID, [category]);

    act(() => {
      callbacks.UPDATE({ new: { ...category, name: "新名" } });
    });

    expect(result.current.categories[0].name).toBe("新名");
  });

  it("UPDATE: sort_order が変われば並びも入れ替わる", () => {
    const a = makeCategory({ id: "c-1", sort_order: 0 });
    const b = makeCategory({ id: "c-2", sort_order: 1 });
    const { result } = renderWithState(HOUSEHOLD_ID, [a, b]);

    act(() => {
      callbacks.UPDATE({ new: { ...a, sort_order: 2 } });
    });

    expect(result.current.categories.map((c) => c.id)).toEqual(["c-2", "c-1"]);
  });

  it("DELETE: 指定した id のカテゴリが削除される", () => {
    const a = makeCategory({ id: "c-1" });
    const b = makeCategory({ id: "c-2" });
    const { result } = renderWithState(HOUSEHOLD_ID, [a, b]);

    act(() => {
      callbacks.DELETE({ old: { id: "c-1" } });
    });

    expect(result.current.categories.map((c) => c.id)).toEqual(["c-2"]);
  });

  it("購読が成立したら onResync が呼ばれる", () => {
    const onResync = vi.fn();
    renderWithState(HOUSEHOLD_ID, [], onResync);

    const handler: SubscribeHandler = mockChannel.subscribe.mock.calls[0][0];
    act(() => {
      handler(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
    });

    expect(onResync).toHaveBeenCalledTimes(1);
  });

  it("アンマウント時に removeChannel が呼ばれる", () => {
    const { unmount } = renderWithState(HOUSEHOLD_ID);
    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
  });
});
