import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTitleSuggestions } from "@/hooks/use-title-suggestions";
import { createClient } from "@/lib/supabase/client";
import { MockQueryChain, createMockSupabase } from "@/test/mocks/supabase";
import { createQueryWrapper } from "@/test/query-wrapper";

vi.mock("@/lib/supabase/client");
vi.mock("@/lib/idle", () => ({
  runWhenIdle: vi.fn((cb: () => void) => {
    cb();
    return vi.fn();
  }),
}));

const HOUSEHOLD_ID = "household-1";

describe("useTitleSuggestions", () => {
  let chain: MockQueryChain;
  let mockClient: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    chain = new MockQueryChain();
    mockClient = createMockSupabase(chain);
    // @ts-expect-error - モックオブジェクトは SupabaseClient の全インターフェースを実装しない
    vi.mocked(createClient).mockReturnValue(mockClient as ReturnType<typeof createClient>);
  });

  it("householdId が null の場合は取得しない", () => {
    renderHook(() => useTitleSuggestions(null), { wrapper: createQueryWrapper() });
    expect(chain.select).not.toHaveBeenCalled();
  });

  it("最新 500 件に絞って取得する", async () => {
    chain._result = { data: [], error: null };
    renderHook(() => useTitleSuggestions(HOUSEHOLD_ID), { wrapper: createQueryWrapper() });

    await waitFor(() => expect(chain.limit).toHaveBeenCalledWith(500));
    expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("入力に部分一致するタイトルを返す（重複は最新の表記だけ残る）", async () => {
    chain._result = {
      data: [
        { title: "牛乳を買う", category_id: "c-1" },
        { title: "牛乳を買う", category_id: "c-2" },
        { title: "卵を買う", category_id: "c-1" },
        { title: "掃除機をかける", category_id: "c-2" },
      ],
      error: null,
    };

    const { result } = renderHook(() => useTitleSuggestions(HOUSEHOLD_ID), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.getSuggestions("買う")).toHaveLength(2));
    expect(result.current.getSuggestions("買う")).toEqual(["牛乳を買う", "卵を買う"]);
  });

  it("categoryId を渡すとそのカテゴリの候補に絞る", async () => {
    chain._result = {
      data: [
        { title: "牛乳を買う", category_id: "c-1" },
        { title: "卵を買う", category_id: "c-2" },
      ],
      error: null,
    };

    const { result } = renderHook(() => useTitleSuggestions(HOUSEHOLD_ID), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.getSuggestions("買う")).toHaveLength(2));
    expect(result.current.getSuggestions("買う", "c-1")).toEqual(["牛乳を買う"]);
  });

  it("空文字では候補を返さない", async () => {
    chain._result = { data: [{ title: "牛乳を買う", category_id: null }], error: null };

    const { result } = renderHook(() => useTitleSuggestions(HOUSEHOLD_ID), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.getSuggestions("牛乳")).toHaveLength(1));
    expect(result.current.getSuggestions("   ")).toEqual([]);
  });
});
