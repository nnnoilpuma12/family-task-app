import { renderHook, act } from "@testing-library/react";
import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRealtimeStapleItems } from "@/hooks/use-realtime-staple-items";
import { createClient } from "@/lib/supabase/client";
import { asSupabaseClient } from "@/test/mocks/supabase";
import type { StapleItem } from "@/types";

vi.mock("@/lib/supabase/client");

const HOUSEHOLD_ID = "household-1";

function makeStapleItem(overrides: Partial<StapleItem> = {}): StapleItem {
  return {
    id: crypto.randomUUID(),
    household_id: HOUSEHOLD_ID,
    name: "テストアイテム",
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

type StapleItemChangePayload = { new?: Partial<StapleItem>; old?: Partial<StapleItem> };

describe("useRealtimeStapleItems", () => {
  let callbacks: Record<string, (payload: StapleItemChangePayload) => void>;
  let mockChannel: { on: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> };
  let mockRemoveChannel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    callbacks = {};
    mockChannel = {
      on: vi.fn().mockImplementation(
        (_type: string, filter: { event: string }, cb: (p: StapleItemChangePayload) => void) => {
          callbacks[filter.event] = cb;
          return mockChannel;
        }
      ),
      subscribe: vi.fn().mockImplementation(() => mockChannel),
    };
    mockRemoveChannel = vi.fn();
    vi.mocked(createClient).mockReturnValue(
      asSupabaseClient({
        channel: vi.fn().mockReturnValue(mockChannel),
        removeChannel: mockRemoveChannel,
      })
    );
  });

  function renderWithState(householdId: string | null, initialItems: StapleItem[] = []) {
    return renderHook(() => {
      const [items, setItems] = useState<StapleItem[]>(initialItems);
      useRealtimeStapleItems(householdId, setItems);
      return { items };
    });
  }

  it("householdId がない場合はチャンネルを作成しない", () => {
    renderWithState(null);
    expect(vi.mocked(createClient)).not.toHaveBeenCalled();
  });

  it("householdId があれば staple_items チャンネルを購読する", () => {
    renderWithState(HOUSEHOLD_ID);
    const channel = vi.mocked(createClient)().channel;
    expect(channel).toHaveBeenCalledWith(`staple_items:${HOUSEHOLD_ID}`);
  });

  it("INSERT: 新しいアイテムが state に追加される", () => {
    const existing = makeStapleItem({ id: "si-1" });
    const { result } = renderWithState(HOUSEHOLD_ID, [existing]);

    const newItem = makeStapleItem({ id: "si-2" });
    act(() => {
      callbacks.INSERT({ new: newItem });
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items.some((si) => si.id === "si-2")).toBe(true);
  });

  it("INSERT: 同じ id のアイテムは重複追加されない", () => {
    const existing = makeStapleItem({ id: "si-1" });
    const { result } = renderWithState(HOUSEHOLD_ID, [existing]);

    act(() => {
      callbacks.INSERT({ new: existing });
    });

    expect(result.current.items).toHaveLength(1);
  });

  it("UPDATE: 既存アイテムの内容が更新される", () => {
    const item = makeStapleItem({ id: "si-1", name: "旧アイテム" });
    const { result } = renderWithState(HOUSEHOLD_ID, [item]);

    const updated = { ...item, name: "新アイテム" };
    act(() => {
      callbacks.UPDATE({ new: updated });
    });

    expect(result.current.items[0].name).toBe("新アイテム");
  });

  it("DELETE: 指定した id のアイテムが削除される", () => {
    const si1 = makeStapleItem({ id: "si-1" });
    const si2 = makeStapleItem({ id: "si-2" });
    const { result } = renderWithState(HOUSEHOLD_ID, [si1, si2]);

    act(() => {
      callbacks.DELETE({ old: { id: "si-1" } });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe("si-2");
  });

  it("アンマウント時に removeChannel が呼ばれる", () => {
    const { unmount } = renderWithState(HOUSEHOLD_ID);
    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
  });
});
