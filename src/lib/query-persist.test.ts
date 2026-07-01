import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PERSIST_KEY, clearPersistedQueryCache } from "@/lib/query-persist";

describe("clearPersistedQueryCache", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("永続キャッシュのキーを削除する", () => {
    window.localStorage.setItem(PERSIST_KEY, JSON.stringify({ foo: "bar" }));
    clearPersistedQueryCache();
    expect(window.localStorage.getItem(PERSIST_KEY)).toBeNull();
  });

  it("キーが無くても落ちない", () => {
    expect(() => clearPersistedQueryCache()).not.toThrow();
  });

  it("localStorage の removeItem が例外を投げても落ちない", () => {
    vi.spyOn(window.localStorage, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => clearPersistedQueryCache()).not.toThrow();
  });
});
