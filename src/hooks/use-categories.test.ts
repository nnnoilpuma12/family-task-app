import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useCategories } from "@/hooks/use-categories";
import { createClient } from "@/lib/supabase/client";
import { MockQueryChain, createMockSupabase } from "@/test/mocks/supabase";
import { createQueryWrapper } from "@/test/query-wrapper";
import { flushQueryUpdates } from "@/test/flush";
import type { Category } from "@/types";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/supabase/client");

const HOUSEHOLD_ID = "household-1";

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: crypto.randomUUID(),
    household_id: HOUSEHOLD_ID,
    name: "テストカテゴリ",
    color: "#6366f1",
    icon: null,
    sort_order: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("useCategories", () => {
  let chain: MockQueryChain;
  let mockClient: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    chain = new MockQueryChain();
    mockClient = createMockSupabase(chain);
    // @ts-expect-error - モックオブジェクトは SupabaseClient の全インターフェースを実装しない
    vi.mocked(createClient).mockReturnValue(mockClient as ReturnType<typeof createClient>);
  });

  describe("addCategory", () => {
    it("sort_order に categories.length を使う", async () => {
      const existing = [makeCategory({ sort_order: 0 }), makeCategory({ sort_order: 1 })];
      chain._result = { data: existing, error: null };

      const { result } = renderHook(() => useCategories(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.categories).toHaveLength(2));

      const newCat = makeCategory({ name: "新カテゴリ", sort_order: 2 });
      chain.single.mockResolvedValueOnce({ data: newCat, error: null });

      await act(async () => {
        await result.current.addCategory("新カテゴリ", "#ff0000");
      });
      await flushQueryUpdates();

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ sort_order: 2 })
      );
      await waitFor(() => expect(result.current.categories).toHaveLength(3));
    });

    it("エラー時: state に追加されない", async () => {
      const existing = [makeCategory({ sort_order: 0 })];
      chain._result = { data: existing, error: null };

      const { result } = renderHook(() => useCategories(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.categories).toHaveLength(1));

      chain.single.mockResolvedValueOnce({ data: null, error: { message: "DB error" } });

      await act(async () => {
        await result.current.addCategory("失敗カテゴリ", "#ff0000");
      });
      await flushQueryUpdates();

      expect(result.current.categories).toHaveLength(1);
    });
  });

  describe("deleteCategory", () => {
    it("正常系: categories から除外される", async () => {
      const cat = makeCategory({ id: "c-1" });
      chain._result = { data: [cat], error: null };

      const { result } = renderHook(() => useCategories(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.categories).toHaveLength(1));

      await act(async () => {
        await result.current.deleteCategory("c-1");
      });
      await flushQueryUpdates();

      await waitFor(() => expect(result.current.categories).toHaveLength(0));
    });
  });

  describe("updateCategory", () => {
    it("name のみ変更して color は維持される", async () => {
      const cat = makeCategory({ id: "c-1", name: "旧名前", color: "#0000ff" });
      chain._result = { data: [cat], error: null };

      const { result } = renderHook(() => useCategories(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.categories).toHaveLength(1));

      await act(async () => {
        await result.current.updateCategory("c-1", { name: "新名前" });
      });
      await flushQueryUpdates();

      await waitFor(() => expect(result.current.categories[0].name).toBe("新名前"));
      expect(result.current.categories[0].color).toBe("#0000ff");
    });

    it("color のみ変更して name は維持される", async () => {
      const cat = makeCategory({ id: "c-1", name: "名前そのまま", color: "#0000ff" });
      chain._result = { data: [cat], error: null };

      const { result } = renderHook(() => useCategories(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.categories).toHaveLength(1));

      await act(async () => {
        await result.current.updateCategory("c-1", { color: "#ff0000" });
      });
      await flushQueryUpdates();

      await waitFor(() => expect(result.current.categories[0].color).toBe("#ff0000"));
      expect(result.current.categories[0].name).toBe("名前そのまま");
    });

    it("エラー時: optimistic update をロールバックする", async () => {
      const cat = makeCategory({ id: "c-1", name: "元の名前", color: "#0000ff" });
      chain._result = { data: [cat], error: null };

      const { result } = renderHook(() => useCategories(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.categories).toHaveLength(1));

      chain._result = { data: null, error: { message: "DB error" } };

      await act(async () => {
        await result.current.updateCategory("c-1", { name: "新しい名前" });
      });
      await flushQueryUpdates();

      expect(result.current.categories[0].name).toBe("元の名前");
    });
  });

  describe("reorderCategories", () => {
    it("正常系: 指定した順序に並び替わる", async () => {
      const cats = [
        makeCategory({ id: "c-1", sort_order: 0 }),
        makeCategory({ id: "c-2", sort_order: 1 }),
      ];
      chain._result = { data: cats, error: null };

      const { result } = renderHook(() => useCategories(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.categories).toHaveLength(2));

      // バックグラウンド再フェッチが起きても正しい順序を返すよう DB 状態を先に更新
      chain._result = {
        data: [
          { ...cats[1], sort_order: 0 },
          { ...cats[0], sort_order: 1 },
        ],
        error: null,
      };

      await act(async () => {
        await result.current.reorderCategories(["c-2", "c-1"]);
      });
      await flushQueryUpdates();

      await waitFor(() => {
        expect(result.current.categories[0].id).toBe("c-2");
        expect(result.current.categories[1].id).toBe("c-1");
      });
    });

    it("エラー時: snapshot にロールバックする", async () => {
      const cats = [
        makeCategory({ id: "c-1", sort_order: 0 }),
        makeCategory({ id: "c-2", sort_order: 1 }),
      ];
      chain._result = { data: cats, error: null };

      const { result } = renderHook(() => useCategories(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });
      await waitFor(() => expect(result.current.categories).toHaveLength(2));

      chain._result = { data: null, error: { message: "DB error" } };

      await act(async () => {
        await result.current.reorderCategories(["c-2", "c-1"]);
      });
      await flushQueryUpdates();

      await waitFor(() => {
        expect(result.current.categories[0].id).toBe("c-1");
        expect(result.current.categories[1].id).toBe("c-2");
      });
    });
  });
});
