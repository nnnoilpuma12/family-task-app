import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useSort } from "@/hooks/use-sort";

const STORAGE_KEY = "task-sort-option";

describe("useSort", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("localStorage に値がない場合は manual がデフォルト", () => {
    const { result } = renderHook(() => useSort());
    expect(result.current.sortOption).toBe("manual");
  });

  it("localStorage に有効な値が保存されていればそれを読み込む", () => {
    localStorage.setItem(STORAGE_KEY, "due_date");
    const { result } = renderHook(() => useSort());
    expect(result.current.sortOption).toBe("due_date");
  });

  it("localStorage に無効な値がある場合は manual にフォールバック", () => {
    localStorage.setItem(STORAGE_KEY, "invalid_option");
    const { result } = renderHook(() => useSort());
    expect(result.current.sortOption).toBe("manual");
  });

  it("setSortOption が state を更新する", () => {
    const { result } = renderHook(() => useSort());

    act(() => {
      result.current.setSortOption("created_desc");
    });

    expect(result.current.sortOption).toBe("created_desc");
  });

  it("setSortOption が localStorage に値を書き込む", () => {
    const { result } = renderHook(() => useSort());

    act(() => {
      result.current.setSortOption("created_asc");
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe("created_asc");
  });

  it("全ての有効オプションを受け付ける", () => {
    const options = ["manual", "created_desc", "created_asc", "due_date"] as const;
    const { result } = renderHook(() => useSort());

    for (const option of options) {
      act(() => {
        result.current.setSortOption(option);
      });
      expect(result.current.sortOption).toBe(option);
    }
  });
});
