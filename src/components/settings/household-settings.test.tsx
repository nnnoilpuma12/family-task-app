import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HouseholdSettings } from "@/components/settings/household-settings";
import { createClient } from "@/lib/supabase/client";
import { createMockSupabase } from "@/test/mocks/supabase";
import type { Household, Profile } from "@/types";

vi.mock("@/lib/supabase/client");
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const member: Profile = {
  id: "user-1",
  household_id: "household-1",
  nickname: "テスト太郎",
  avatar_url: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

function household(overrides: Partial<Household> = {}): Household {
  return {
    id: "household-1",
    name: "変更前",
    invite_code: "A1B2C3D4E5F60718",
    invite_code_expires_at: "2026-10-22T00:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2026-10-21T00:00:00Z",
    ...overrides,
  };
}

function renderSettings(value: Household, onUpdate = vi.fn()) {
  return {
    onUpdate,
    ...render(
      <HouseholdSettings
        household={value}
        onUpdate={onUpdate}
        members={[member]}
        currentUserId={member.id}
      />
    ),
  };
}

describe("HouseholdSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const client = createMockSupabase();
    vi.mocked(createClient).mockReturnValue(client as never);
  });

  it("未編集中なら別端末から届いた世帯名と招待コードを反映する", () => {
    const initial = household();
    const view = renderSettings(initial);
    const updated = household({
      name: "パートナーが変更",
      invite_code: "1111222233334444",
      updated_at: "2026-10-21T01:00:00Z",
    });

    view.rerender(
      <HouseholdSettings
        household={updated}
        onUpdate={view.onUpdate}
        members={[member]}
        currentUserId={member.id}
      />
    );

    expect(screen.getByLabelText("家族の名前")).toHaveValue("パートナーが変更");
    expect(screen.getByText("1111222233334444")).toBeInTheDocument();
  });

  it("編集中の入力は外部更新で消さない", async () => {
    const user = userEvent.setup();
    const view = renderSettings(household());
    const input = screen.getByLabelText("家族の名前");
    await user.clear(input);
    await user.type(input, "入力途中");

    view.rerender(
      <HouseholdSettings
        household={household({ name: "外部更新", updated_at: "2026-10-21T01:00:00Z" })}
        onUpdate={view.onUpdate}
        members={[member]}
        currentUserId={member.id}
      />
    );

    expect(input).toHaveValue("入力途中");
  });

  it("編集開始後に外部更新があれば古い値で上書きしない", async () => {
    const { toast } = await import("sonner");
    const client = createMockSupabase();
    client._table("households").single.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "No rows" },
    });
    vi.mocked(createClient).mockReturnValue(client as never);
    const user = userEvent.setup();
    const view = renderSettings(household());
    const input = screen.getByLabelText("家族の名前");
    await user.clear(input);
    await user.type(input, "古い画面から保存");

    const remote = household({ name: "最新の名前", updated_at: "2026-10-21T01:00:00Z" });
    view.rerender(
      <HouseholdSettings
        household={remote}
        onUpdate={view.onUpdate}
        members={[member]}
        currentUserId={member.id}
      />
    );
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(client._table("households").eq).toHaveBeenCalledWith(
      "updated_at",
      "2026-10-21T00:00:00Z"
    );
    expect(view.onUpdate).not.toHaveBeenCalled();
    expect(input).toHaveValue("最新の名前");
  });
});
