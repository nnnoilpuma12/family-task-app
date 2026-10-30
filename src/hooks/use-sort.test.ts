import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useSort } from "@/hooks/use-sort";

const STORAGE_KEY = "task-sort-option";

describe("useSort", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("localStorage に値がない場合は manual がデフォルト", () => {
    const { result } = renderHook(() => useSort());
    expect(result.current.sortOption).toBe("manual");
  });

  it("localStorage に無効な値がある場合は manual にフォールバック", () => {
    localStorage.setItem(STORAGE_KEY, "invalid_option");
    const { result } = renderHook(() => useSort());
    expect(result.current.sortOption).toBe("manual");
  });

  it.each(["manual", "created_desc", "created_asc", "due_date"] as const)(
    "%s を選ぶと表示と保存値が変わり、再マウント後も復元される", (option) => {
      const view = renderHook(() => useSort());
      act(() => view.result.current.setSortOption(option));
      expect(view.result.current.sortOption).toBe(option);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(option);
      view.unmount();
      const restored = renderHook(() => useSort());
      expect(restored.result.current.sortOption).toBe(option);
    }
  );

  it("ストレージを読めなくてもデフォルトで表示できる", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => { throw new Error("storage disabled"); });
    const { result } = renderHook(() => useSort());
    expect(result.current.sortOption).toBe("manual");
  });

  it("保存容量が不足しても画面上の並び順は変更できる", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => { throw new Error("quota exceeded"); });
    const { result } = renderHook(() => useSort());
    act(() => result.current.setSortOption("due_date"));
    expect(result.current.sortOption).toBe("due_date");
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
