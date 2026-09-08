import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useIdleReady } from "@/hooks/use-idle-ready";
import { runWhenIdle } from "@/lib/idle";

vi.mock("@/lib/idle", () => ({
  runWhenIdle: vi.fn(),
}));

describe("useIdleReady", () => {
  /** 直近の runWhenIdle 呼び出しに渡されたコールバック（＝アイドル到達を手動で起こす） */
  function fireIdle() {
    const calls = vi.mocked(runWhenIdle).mock.calls;
    const callback = calls[calls.length - 1][0];
    act(() => callback());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runWhenIdle).mockReturnValue(vi.fn());
  });

  it("アイドル到達までは isReady が false のまま", () => {
    const { result } = renderHook(() => useIdleReady(true));

    expect(result.current.isReady).toBe(false);
  });

  it("アイドル到達で isReady が true になる", () => {
    const { result } = renderHook(() => useIdleReady(true));

    fireIdle();

    expect(result.current.isReady).toBe(true);
  });

  it("enabled が false のあいだはスケジュールしない", () => {
    const { result } = renderHook(() => useIdleReady(false));

    expect(runWhenIdle).not.toHaveBeenCalled();
    expect(result.current.isReady).toBe(false);
  });

  it("enabled が後から true になった時点でスケジュールする", () => {
    const { result, rerender } = renderHook(({ enabled }) => useIdleReady(enabled), {
      initialProps: { enabled: false },
    });

    rerender({ enabled: true });
    fireIdle();

    expect(result.current.isReady).toBe(true);
  });

  it("markReady でアイドルを待たずに有効化できる", () => {
    const { result } = renderHook(() => useIdleReady(true));

    act(() => result.current.markReady());

    expect(result.current.isReady).toBe(true);
  });

  // スケジュール済みのコールバックがアンマウント後に発火すると
  // 解放済みコンポーネントへの setState になるため、キャンセルは必須。
  it("アンマウント時にスケジュールをキャンセルする", () => {
    const cancel = vi.fn();
    vi.mocked(runWhenIdle).mockReturnValue(cancel);

    const { unmount } = renderHook(() => useIdleReady(true));
    unmount();

    expect(cancel).toHaveBeenCalled();
  });
});
