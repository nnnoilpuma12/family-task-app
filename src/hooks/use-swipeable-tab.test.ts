import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSwipeableTab } from "@/hooks/use-swipeable-tab";
import type { RefObject } from "react";

// Touch オブジェクト生成ヘルパー
function makeTouch(target: Element, clientX: number, clientY: number): Touch {
  return new Touch({
    identifier: Date.now(),
    target,
    clientX,
    clientY,
    screenX: clientX,
    screenY: clientY,
    pageX: clientX,
    pageY: clientY,
    radiusX: 0,
    radiusY: 0,
    rotationAngle: 0,
    force: 1,
  });
}

function dispatchTouch(
  element: HTMLElement,
  type: string,
  touches: Array<{ clientX: number; clientY: number }>
) {
  const touchObjs = touches.map((t) => makeTouch(element, t.clientX, t.clientY));
  const event = new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches: touchObjs,
    changedTouches: touchObjs,
  });
  element.dispatchEvent(event);
}

describe("useSwipeableTab", () => {
  let container: HTMLDivElement;
  let containerRef: RefObject<HTMLDivElement>;
  let onChangeIndex: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    // offsetWidth を 375 に設定 (実際の DOM では jsdom が 0 を返すため)
    Object.defineProperty(container, "offsetWidth", { value: 375, configurable: true });
    document.body.appendChild(container);
    containerRef = { current: container };
    onChangeIndex = vi.fn();
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  it("横スワイプ (absDx > absDy * 2) で container に translateX が適用される", () => {
    renderHook(() =>
      useSwipeableTab({ containerRef, tabCount: 3, activeIndex: 1, onChangeIndex })
    );

    // touchstart
    dispatchTouch(container, "touchstart", [{ clientX: 100, clientY: 100 }]);
    // touchmove: dx=30, dy=5 → absDx(30) > absDy*2(10) → horizontal lock
    dispatchTouch(container, "touchmove", [{ clientX: 130, clientY: 105 }]);

    expect(container.style.transform).toMatch(/translateX/);
  });

  it("縦スワイプ (absDy >= absDx / 2) では container に transform が適用されない", () => {
    renderHook(() =>
      useSwipeableTab({ containerRef, tabCount: 3, activeIndex: 1, onChangeIndex })
    );

    dispatchTouch(container, "touchstart", [{ clientX: 100, clientY: 100 }]);
    // touchmove: dx=5, dy=30 → absDx(5) <= absDy*2(60) → vertical → swiping=false
    dispatchTouch(container, "touchmove", [{ clientX: 105, clientY: 130 }]);

    expect(container.style.transform).toBe("");
  });

  it("端 (index=0) で右スワイプすると抵抗 (0.3x) が適用される", () => {
    renderHook(() =>
      useSwipeableTab({ containerRef, tabCount: 3, activeIndex: 0, onChangeIndex })
    );

    dispatchTouch(container, "touchstart", [{ clientX: 100, clientY: 100 }]);
    // dx=100, 右スワイプ (index=0, atStart=true) → effectiveDx = 100 * 0.3 = 30
    dispatchTouch(container, "touchmove", [{ clientX: 200, clientY: 100 }]);

    expect(container.style.transform).toBe("translateX(30px)");
  });

  it("iOS バックジェスチャー回避: clientX < 20 の touchstart はスワイプ開始しない", () => {
    renderHook(() =>
      useSwipeableTab({ containerRef, tabCount: 3, activeIndex: 1, onChangeIndex })
    );

    // clientX=10 < 20 → handleTouchStart が early return
    dispatchTouch(container, "touchstart", [{ clientX: 10, clientY: 100 }]);
    // 大きく横移動してもスワイプが開始されていないので何も起きない
    dispatchTouch(container, "touchmove", [{ clientX: 80, clientY: 100 }]);
    dispatchTouch(container, "touchend", []);
    container.dispatchEvent(new Event("transitionend"));

    expect(onChangeIndex).not.toHaveBeenCalled();
  });

  it("速度 > 0.3 px/ms でスワイプ成立し onChangeIndex が呼ばれる", async () => {
    vi.useFakeTimers();

    renderHook(() =>
      useSwipeableTab({ containerRef, tabCount: 3, activeIndex: 1, onChangeIndex })
    );

    await act(async () => {
      dispatchTouch(container, "touchstart", [{ clientX: 100, clientY: 100 }]);
      // 100ms 経過させる
      vi.advanceTimersByTime(100);
      // dx=-50 左スワイプ → velocity = 50 / 100 = 0.5 > 0.3 → shouldSwipe=true
      dispatchTouch(container, "touchmove", [{ clientX: 50, clientY: 100 }]);
      dispatchTouch(container, "touchend", []);
      // transitionend を手動で発火して onChangeIndex コールバックをトリガー
      container.dispatchEvent(new Event("transitionend"));
    });

    expect(onChangeIndex).toHaveBeenCalledWith(2); // activeIndex(1) + 1

    vi.useRealTimers();
  });
});
