import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useCategories } from "@/hooks/use-categories";
import { createClient } from "@/lib/supabase/client";
import { MockQueryChain, createMockSupabase } from "@/test/mocks/supabase";
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
    vi.mocked(createClient).mockReturnValue(mockClient as ReturnType<typeof createClient>);
  });

  describe("addCategory", () => {
    it("sort_order に categories.length を使う", async () => {
      const existing = [makeCategory({ sort_order: 0 }), makeCategory({ sort_order: 1 })];
      chain._result = { data: existing, error: null };

      const { result } = renderHook(() => useCategories(HOUSEHOLD_ID));
      await waitFor(() => expect(result.current.categories).toHaveLength(2));

      const newCat = makeCategory({ name: "新カテゴリ", sort_order: 2 });
      chain.single.mockResolvedValueOnce({ data: newCat, error: null });

      await act(async () => {
        await result.current.addCategory("新カテゴリ", "#ff0000");
      });

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ sort_order: 2 })
      );
      expect(result.current.categories).toHaveLength(3);
    });
  });

  describe("deleteCategory", () => {
    it("正常系: categories から除外される", async () => {
      const cat = makeCategory({ id: "c-1" });
      chain._result = { data: [cat], error: null };

      const { result } = renderHook(() => useCategories(HOUSEHOLD_ID));
      await waitFor(() => expect(result.current.categories).toHaveLength(1));

      await act(async () => {
        await result.current.deleteCategory("c-1");
      });

      expect(result.current.categories).toHaveLength(0);
    });
  });

  describe("updateCategory", () => {
    it("name のみ変更して color は維持される", async () => {
      const cat = makeCategory({ id: "c-1", name: "旧名前", color: "#0000ff" });
      chain._result = { data: [cat], error: null };

      const { result } = renderHook(() => useCategories(HOUSEHOLD_ID));
      await waitFor(() => expect(result.current.categories).toHaveLength(1));

      await act(async () => {
        await result.current.updateCategory("c-1", { name: "新名前" });
      });

      expect(result.current.categories[0].name).toBe("新名前");
      expect(result.current.categories[0].color).toBe("#0000ff");
    });
  });
});
