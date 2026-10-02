import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { useRealtimeResync } from "@/hooks/use-realtime-resync";
import { queryKeys } from "@/lib/query-keys";
import { createQueryWrapperWithClient } from "@/test/query-wrapper";

const HOUSEHOLD_ID = "household-1";

/** spy の型を推論させるためのヘルパ（型アサーションを避ける） */
function spyOnInvalidate(client: QueryClient) {
  return vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

describe("useRealtimeResync", () => {
  let queryClient: QueryClient;
  let wrapper: ReturnType<typeof createQueryWrapperWithClient>["wrapper"];
  let invalidate: ReturnType<typeof spyOnInvalidate>;

  beforeEach(() => {
    // Date.now() を進められるようにする（スロットルの検証用）
    vi.useFakeTimers();
    setVisibility("visible");
    ({ wrapper, queryClient } = createQueryWrapperWithClient());
    invalidate = spyOnInvalidate(queryClient);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** invalidate に渡された queryKey の一覧 */
  function invalidatedKeys() {
    return invalidate.mock.calls.map((call) => call[0]?.queryKey);
  }

  it("可視化されたら世帯スコープのクエリを取り直す", () => {
    renderHook(() => useRealtimeResync(HOUSEHOLD_ID), { wrapper });

    document.dispatchEvent(new Event("visibilitychange"));

    vi.advanceTimersByTime(50);
    expect(invalidatedKeys()).toEqual([
      queryKeys.tasks(HOUSEHOLD_ID),
      queryKeys.categories(HOUSEHOLD_ID),
      queryKeys.stapleItems(HOUSEHOLD_ID),
    ]);
  });

  it("オンライン復帰でも取り直す", () => {
    renderHook(() => useRealtimeResync(HOUSEHOLD_ID), { wrapper });

    window.dispatchEvent(new Event("online"));

    vi.advanceTimersByTime(50);
    expect(invalidate).toHaveBeenCalledTimes(3);
  });

  it("非表示のあいだは取り直さない", () => {
    renderHook(() => useRealtimeResync(HOUSEHOLD_ID), { wrapper });
    setVisibility("hidden");

    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));

    vi.advanceTimersByTime(50);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("重いレコメンド RPC は再同期の対象に含めない", () => {
    renderHook(() => useRealtimeResync(HOUSEHOLD_ID), { wrapper });

    document.dispatchEvent(new Event("visibilitychange"));

    vi.advanceTimersByTime(50);
    expect(invalidatedKeys()).not.toContainEqual(
      queryKeys.recommendations(HOUSEHOLD_ID)
    );
  });

  it("連続発火は最小間隔でスロットルされる", () => {
    renderHook(() => useRealtimeResync(HOUSEHOLD_ID), { wrapper });

    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("online"));

    vi.advanceTimersByTime(50);
    expect(invalidate).toHaveBeenCalledTimes(3); // 1 回分（3 キー）のみ
  });

  it("最小間隔を過ぎれば再び取り直す", async () => {
    renderHook(() => useRealtimeResync(HOUSEHOLD_ID), { wrapper });

    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(2000);
    window.dispatchEvent(new Event("online"));

    vi.advanceTimersByTime(50);
    expect(invalidate).toHaveBeenCalledTimes(6); // 2 回分
  });

  it("householdId が無いあいだは何も購読しない", () => {
    renderHook(() => useRealtimeResync(null), { wrapper });

    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));

    vi.advanceTimersByTime(50);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("アンマウント後はリスナが残らない", () => {
    const { unmount } = renderHook(() => useRealtimeResync(HOUSEHOLD_ID), {
      wrapper,
    });
    unmount();

    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));

    vi.advanceTimersByTime(50);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
