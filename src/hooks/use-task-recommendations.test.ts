import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTaskRecommendations } from "@/hooks/use-task-recommendations";
import { createClient } from "@/lib/supabase/client";
import { MockQueryChain, createMockSupabase } from "@/test/mocks/supabase";
import type { TaskRecommendation } from "@/types";

vi.mock("@/lib/supabase/client");
vi.mock("@/lib/idle", () => ({
  runWhenIdle: vi.fn((cb: () => void) => {
    cb();
    return vi.fn();
  }),
}));

const HOUSEHOLD_ID = "household-1";
const PROFILE_ID = "profile-1";

function makeRecommendation(overrides: Partial<TaskRecommendation> = {}): TaskRecommendation {
  return {
    normalized_title: "掃除",
    latest_title: "掃除する",
    latest_category_id: null,
    latest_memo: null,
    median_interval_days: 7,
    days_since_last: 10,
    completion_count: 3,
    last_completed_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("useTaskRecommendations", () => {
  let chain: MockQueryChain;
  let mockClient: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    chain = new MockQueryChain();
    mockClient = createMockSupabase(chain);
    // @ts-expect-error - モックオブジェクトは SupabaseClient の全インターフェースを実装しない
    vi.mocked(createClient).mockReturnValue(mockClient as ReturnType<typeof createClient>);
  });

  it("householdId があれば RPC を呼び recommendations をセットする", async () => {
    const recs = [makeRecommendation()];
    mockClient.rpc.mockResolvedValue({ data: recs, error: null });

    const { result } = renderHook(() =>
      useTaskRecommendations(HOUSEHOLD_ID, PROFILE_ID)
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockClient.rpc).toHaveBeenCalledWith("get_recurring_recommendations");
    expect(result.current.recommendations).toEqual(recs);
  });

  it("householdId が null の場合は RPC を呼ばず loading が true のまま", () => {
    const { result } = renderHook(() => useTaskRecommendations(null));
    expect(mockClient.rpc).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
  });

  it("RPC エラーでも loading が false になる", async () => {
    mockClient.rpc.mockResolvedValue({ data: null, error: { message: "RPC error" } });

    const { result } = renderHook(() =>
      useTaskRecommendations(HOUSEHOLD_ID)
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.recommendations).toHaveLength(0);
  });

  describe("dismiss", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("指定した normalized_title が state から除去される", async () => {
      const rec1 = makeRecommendation({ normalized_title: "掃除" });
      const rec2 = makeRecommendation({ normalized_title: "洗濯" });
      mockClient.rpc.mockResolvedValue({ data: [rec1, rec2], error: null });

      const { result } = renderHook(() =>
        useTaskRecommendations(HOUSEHOLD_ID, PROFILE_ID)
      );
      await waitFor(() => expect(result.current.recommendations).toHaveLength(2));

      await act(async () => {
        await result.current.dismiss("掃除", 7);
      });

      expect(result.current.recommendations).toHaveLength(1);
      expect(result.current.recommendations[0].normalized_title).toBe("洗濯");
    });

    it("dismissed_until が medianDays 分後の日付になっている", async () => {
      const rec = makeRecommendation({ median_interval_days: 14 });
      mockClient.rpc.mockResolvedValue({ data: [rec], error: null });

      const { result } = renderHook(() =>
        useTaskRecommendations(HOUSEHOLD_ID, PROFILE_ID)
      );
      // recommendations がロードされてから時刻を固定する（waitFor は setTimeout を使うため）
      await waitFor(() => expect(result.current.recommendations).toHaveLength(1));

      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));

      await act(async () => {
        await result.current.dismiss("掃除", 14);
      });

      const expectedDate = new Date("2024-06-29T12:00:00Z").toISOString();
      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ dismissed_until: expectedDate }),
        expect.any(Object)
      );
    });

    it("profileId がある場合は dismissed_by に含まれる", async () => {
      const rec = makeRecommendation();
      mockClient.rpc.mockResolvedValue({ data: [rec], error: null });

      const { result } = renderHook(() =>
        useTaskRecommendations(HOUSEHOLD_ID, PROFILE_ID)
      );
      await waitFor(() => expect(result.current.recommendations).toHaveLength(1));

      await act(async () => {
        await result.current.dismiss("掃除", 7);
      });

      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ dismissed_by: PROFILE_ID }),
        expect.any(Object)
      );
    });
  });
});
