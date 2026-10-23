import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getCachedHouseholdId,
  getCachedHouseholdName,
  setCachedHousehold,
  clearCachedHousehold,
  HOUSEHOLD_CHANGED_EVENT,
} from "@/lib/household-cache";

describe("household-cache", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("未設定時は id / name とも null", () => {
    expect(getCachedHouseholdId()).toBeNull();
    expect(getCachedHouseholdName()).toBeNull();
  });

  it("set した id / name を取得できる", () => {
    setCachedHousehold("household-1", "わが家");
    expect(getCachedHouseholdId()).toBe("household-1");
    expect(getCachedHouseholdName()).toBe("わが家");
  });

  it("clear で消える", () => {
    setCachedHousehold("household-1", "わが家");
    clearCachedHousehold();
    expect(getCachedHouseholdId()).toBeNull();
    expect(getCachedHouseholdName()).toBeNull();
  });

  it("壊れた JSON は null を返す", () => {
    window.localStorage.setItem("family-task:household-cache", "{not json");
    expect(getCachedHouseholdId()).toBeNull();
    expect(getCachedHouseholdName()).toBeNull();
  });

  it("id / name が欠けたオブジェクトは null を返す", () => {
    window.localStorage.setItem(
      "family-task:household-cache",
      JSON.stringify({ id: "household-1" })
    );
    expect(getCachedHouseholdId()).toBeNull();
    expect(getCachedHouseholdName()).toBeNull();
  });

  it("localStorage の setItem が例外を投げても落ちない", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    expect(() => setCachedHousehold("household-1", "わが家")).not.toThrow();
  });

  it("別の世帯へ切り替わったら同一タブへ変更を通知する", () => {
    const listener = vi.fn();
    window.addEventListener(HOUSEHOLD_CHANGED_EVENT, listener);
    setCachedHousehold("household-1", "わが家");
    setCachedHousehold("household-1", "新しい名前");
    expect(listener).not.toHaveBeenCalled();

    setCachedHousehold("household-2", "別の家族");
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(HOUSEHOLD_CHANGED_EVENT, listener);
  });
});
