import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatDueDate, getQuickDate } from "@/lib/date";

describe("formatDueDate", () => {
  beforeEach(() => {
    // 2024-06-15 12:00:00 UTC に固定
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("当日の日付は「今日」を返す", () => {
    expect(formatDueDate("2024-06-15T00:00:00Z")).toBe("今日");
  });

  it("翌日の日付は「明日」を返す", () => {
    expect(formatDueDate("2024-06-16T00:00:00Z")).toBe("明日");
  });

  it("それ以外は M/D 形式を返す", () => {
    expect(formatDueDate("2024-07-04T00:00:00Z")).toBe("7/4");
  });

  it("1桁の月・日もそのまま返す", () => {
    expect(formatDueDate("2024-01-09T00:00:00Z")).toBe("1/9");
  });

  it("過去の日付も M/D 形式で返す", () => {
    expect(formatDueDate("2024-03-20T00:00:00Z")).toBe("3/20");
  });
});

describe("getQuickDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offset=0 は今日の YYYY-MM-DD を返す", () => {
    expect(getQuickDate(0)).toBe("2024-06-15");
  });

  it("offset=1 は明日の YYYY-MM-DD を返す", () => {
    expect(getQuickDate(1)).toBe("2024-06-16");
  });

  it("offset=3 は3日後の YYYY-MM-DD を返す", () => {
    expect(getQuickDate(3)).toBe("2024-06-18");
  });

  it("月末をまたぐ場合も正しく計算される", () => {
    vi.setSystemTime(new Date("2024-06-30T12:00:00Z"));
    expect(getQuickDate(1)).toBe("2024-07-01");
  });
});
