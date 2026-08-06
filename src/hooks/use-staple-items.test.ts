import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { useStapleItems } from "@/hooks/use-staple-items";
import { createClient } from "@/lib/supabase/client";
import { createMockSupabase } from "@/test/mocks/supabase";
import { createQueryWrapper } from "@/test/query-wrapper";
import { flushQueryUpdates } from "@/test/flush";
import type { StapleItem } from "@/types";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/supabase/client");

const HOUSEHOLD_ID = "household-1";

function makeStapleItem(overrides: Partial<StapleItem> = {}): StapleItem {
  return {
    id: crypto.randomUUID(),
    household_id: HOUSEHOLD_ID,
    name: "定番品",
    category_id: null,
    default_quantity: null,
    default_unit: null,
    note: null,
    icon: null,
    sort_order: 0,
    use_count: 0,
    last_used_at: null,
    created_by: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("useStapleItems", () => {
  let mockClient: ReturnType<typeof createMockSupabase>;

  function setup(items: StapleItem[]) {
    mockClient = createMockSupabase({ staple_items: { data: items } });
    // @ts-expect-error - モックオブジェクトは SupabaseClient の全インターフェースを実装しない
    vi.mocked(createClient).mockReturnValue(mockClient as ReturnType<typeof createClient>);
    return mockClient._table("staple_items");
  }

  async function renderLoaded(items: StapleItem[]) {
    const chain = setup(items);
    const { result } = renderHook(() => useStapleItems(HOUSEHOLD_ID), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.stapleItems).toHaveLength(items.length));
    return { result, chain };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("取得", () => {
    it("householdId が null なら loading のまま fetch しない", async () => {
      const client = createMockSupabase({ staple_items: { data: [] } });
      // @ts-expect-error - モックオブジェクトは SupabaseClient の全インターフェースを実装しない
      vi.mocked(createClient).mockReturnValue(client as ReturnType<typeof createClient>);

      const { result } = renderHook(() => useStapleItems(null), {
        wrapper: createQueryWrapper(),
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.stapleItems).toEqual([]);
      expect(client.from).not.toHaveBeenCalled();
    });

    it("sort_order 順で取得する", async () => {
      const items = [
        makeStapleItem({ id: "s-1", name: "牛乳", sort_order: 0 }),
        makeStapleItem({ id: "s-2", name: "卵", sort_order: 1 }),
      ];
      const { result, chain } = await renderLoaded(items);

      expect(chain.eq).toHaveBeenCalledWith("household_id", HOUSEHOLD_ID);
      expect(chain.order).toHaveBeenCalledWith("sort_order");
      expect(result.current.stapleItems.map((i) => i.id)).toEqual(["s-1", "s-2"]);
    });

    it("取得失敗時にトーストを出す", async () => {
      const client = createMockSupabase({
        staple_items: { data: null, error: { message: "DB error" } },
      });
      // @ts-expect-error - モックオブジェクトは SupabaseClient の全インターフェースを実装しない
      vi.mocked(createClient).mockReturnValue(client as ReturnType<typeof createClient>);

      renderHook(() => useStapleItems(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("定番品の取得に失敗しました")
      );
    });
  });

  describe("addStapleItem", () => {
    it("sort_order に stapleItems.length を使い、保存後の行で置き換える", async () => {
      const existing = [
        makeStapleItem({ id: "s-1", sort_order: 0 }),
        makeStapleItem({ id: "s-2", sort_order: 1 }),
      ];
      const { result, chain } = await renderLoaded(existing);

      const saved = makeStapleItem({ id: "s-3", name: "パン", sort_order: 2 });
      chain.single.mockResolvedValueOnce({ data: saved, error: null });

      await act(async () => {
        await result.current.addStapleItem({ name: "パン" });
      });
      await flushQueryUpdates();

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "パン",
          household_id: HOUSEHOLD_ID,
          sort_order: 2,
        })
      );
      await waitFor(() => expect(result.current.stapleItems).toHaveLength(3));
      // 楽観追加時の一時 id ではなく、保存された行の id になっている
      expect(result.current.stapleItems[2].id).toBe("s-3");
    });

    it("エラー時: 楽観追加した行を取り除きトーストを出す", async () => {
      const existing = [makeStapleItem({ id: "s-1" })];
      const { result, chain } = await renderLoaded(existing);

      chain.single.mockResolvedValueOnce({ data: null, error: { message: "DB error" } });

      await act(async () => {
        await result.current.addStapleItem({ name: "失敗する定番品" });
      });
      await flushQueryUpdates();

      expect(result.current.stapleItems).toHaveLength(1);
      expect(result.current.stapleItems[0].id).toBe("s-1");
      expect(toast.error).toHaveBeenCalledWith("定番品の追加に失敗しました");
    });
  });

  describe("updateStapleItem", () => {
    it("指定フィールドのみ更新し、他は維持される", async () => {
      const item = makeStapleItem({ id: "s-1", name: "旧名前", note: "メモ" });
      const { result, chain } = await renderLoaded([item]);

      await act(async () => {
        await result.current.updateStapleItem("s-1", { name: "新名前" });
      });
      await flushQueryUpdates();

      expect(chain.update).toHaveBeenCalledWith({ name: "新名前" });
      expect(chain.eq).toHaveBeenCalledWith("id", "s-1");
      await waitFor(() => expect(result.current.stapleItems[0].name).toBe("新名前"));
      expect(result.current.stapleItems[0].note).toBe("メモ");
    });

    it("エラー時: snapshot にロールバックしトーストを出す", async () => {
      const item = makeStapleItem({ id: "s-1", name: "元の名前" });
      const { result, chain } = await renderLoaded([item]);

      chain._result = { data: null, error: { message: "DB error" } };

      await act(async () => {
        await result.current.updateStapleItem("s-1", { name: "新しい名前" });
      });
      await flushQueryUpdates();

      expect(result.current.stapleItems[0].name).toBe("元の名前");
      expect(toast.error).toHaveBeenCalledWith("定番品の更新に失敗しました");
    });
  });

  describe("deleteStapleItem", () => {
    it("正常系: 一覧から取り除かれる", async () => {
      const items = [makeStapleItem({ id: "s-1" }), makeStapleItem({ id: "s-2" })];
      const { result, chain } = await renderLoaded(items);

      await act(async () => {
        await result.current.deleteStapleItem("s-1");
      });
      await flushQueryUpdates();

      expect(chain.delete).toHaveBeenCalled();
      await waitFor(() => expect(result.current.stapleItems).toHaveLength(1));
      expect(result.current.stapleItems[0].id).toBe("s-2");
    });

    it("エラー時: 削除前の一覧にロールバックしトーストを出す", async () => {
      const items = [makeStapleItem({ id: "s-1" }), makeStapleItem({ id: "s-2" })];
      const { result, chain } = await renderLoaded(items);

      chain._result = { data: null, error: { message: "DB error" } };

      await act(async () => {
        await result.current.deleteStapleItem("s-1");
      });
      await flushQueryUpdates();

      expect(result.current.stapleItems.map((i) => i.id)).toEqual(["s-1", "s-2"]);
      expect(toast.error).toHaveBeenCalledWith("定番品の削除に失敗しました");
    });
  });

  describe("reorderStapleItems", () => {
    it("正常系: 指定順に並び替え sort_order を振り直す", async () => {
      const items = [
        makeStapleItem({ id: "s-1", sort_order: 0 }),
        makeStapleItem({ id: "s-2", sort_order: 1 }),
      ];
      const { result } = await renderLoaded(items);

      await act(async () => {
        await result.current.reorderStapleItems(["s-2", "s-1"]);
      });
      await flushQueryUpdates();

      expect(mockClient.rpc).toHaveBeenCalledWith("reorder_staple_items", {
        p_item_ids: ["s-2", "s-1"],
        p_sort_orders: [0, 1],
      });
      await waitFor(() => {
        expect(result.current.stapleItems.map((i) => i.id)).toEqual(["s-2", "s-1"]);
      });
      expect(result.current.stapleItems.map((i) => i.sort_order)).toEqual([0, 1]);
    });

    it("エラー時: snapshot にロールバックしトーストを出す", async () => {
      const items = [
        makeStapleItem({ id: "s-1", sort_order: 0 }),
        makeStapleItem({ id: "s-2", sort_order: 1 }),
      ];
      const { result, chain } = await renderLoaded(items);

      // 再フェッチが結果を上書きしないようにしたうえで RPC を失敗させる
      chain._result = { data: null, error: { message: "DB error" } };
      mockClient.rpc.mockResolvedValueOnce({ data: null, error: { message: "RPC error" } });

      await act(async () => {
        await result.current.reorderStapleItems(["s-2", "s-1"]);
      });
      await flushQueryUpdates();

      expect(result.current.stapleItems.map((i) => i.id)).toEqual(["s-1", "s-2"]);
      expect(toast.error).toHaveBeenCalledWith("定番品の並び替えに失敗しました");
    });

    it("存在しない id は結果から除外される", async () => {
      const items = [makeStapleItem({ id: "s-1", sort_order: 0 })];
      const { result } = await renderLoaded(items);

      await act(async () => {
        await result.current.reorderStapleItems(["s-1", "missing"]);
      });
      await flushQueryUpdates();

      await waitFor(() => expect(result.current.stapleItems).toHaveLength(1));
      expect(result.current.stapleItems[0].id).toBe("s-1");
    });
  });

  describe("recordUsage", () => {
    it("use_count を +1 し last_used_at を更新する", async () => {
      const item = makeStapleItem({ id: "s-1", use_count: 4, last_used_at: null });
      const { result, chain } = await renderLoaded([item]);

      await act(async () => {
        await result.current.recordUsage("s-1");
      });
      await flushQueryUpdates();

      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ use_count: 5, last_used_at: expect.any(String) })
      );
      expect(chain.eq).toHaveBeenCalledWith("id", "s-1");
      await waitFor(() => expect(result.current.stapleItems[0].use_count).toBe(5));
      expect(result.current.stapleItems[0].last_used_at).not.toBeNull();
    });

    it("存在しない id なら何もしない", async () => {
      const { result, chain } = await renderLoaded([makeStapleItem({ id: "s-1" })]);

      await act(async () => {
        await result.current.recordUsage("missing");
      });
      await flushQueryUpdates();

      expect(chain.update).not.toHaveBeenCalled();
    });
  });
});
