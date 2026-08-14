import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import SettingsPage from "@/app/settings/page";
import { createClient } from "@/lib/supabase/client";
import { clearCachedHousehold } from "@/lib/household-cache";
import { clearPersistedQueryCache } from "@/lib/query-persist";
import { createMockSupabase } from "@/test/mocks/supabase";
import { createQueryWrapper } from "@/test/query-wrapper";

/**
 * ログアウトは「別ユーザーに前ユーザーのデータを見せない」境界。
 * in-memory (queryClient.clear) と端末側 (household-cache / 永続キャッシュ) の
 * 3 つを破棄してから signOut する必要がある。
 */

vi.mock("@/lib/supabase/client");
vi.mock("@/lib/household-cache", () => ({ clearCachedHousehold: vi.fn() }));
vi.mock("@/lib/query-persist", () => ({ clearPersistedQueryCache: vi.fn() }));

vi.mock("@/hooks/use-page-data", () => ({
  usePageData: () => ({
    profile: null,
    setProfile: vi.fn(),
    members: [],
    household: null,
    setHousehold: vi.fn(),
    loading: false,
  }),
}));

vi.mock("@/hooks/use-categories", () => ({
  useCategories: () => ({
    categories: [],
    addCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    reorderCategories: vi.fn(),
  }),
}));

// ログアウト経路の検証が目的なので、設定パネル本体は差し替える
vi.mock("@/components/settings/notification-settings", () => ({
  NotificationSettings: () => <div>通知設定</div>,
}));
vi.mock("@/components/settings/category-settings", () => ({
  CategorySettings: () => <div>カテゴリ設定</div>,
}));

const mockRouter = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/settings",
}));

let mockClient: ReturnType<typeof createMockSupabase>;
let signOut: ReturnType<typeof createMockSupabase>["auth"]["signOut"];

async function clickLogout() {
  const user = userEvent.setup();
  render(<SettingsPage />, { wrapper: createQueryWrapper() });
  await user.click(screen.getByRole("button", { name: /ログアウト/ }));
}

describe("SettingsPage のログアウト", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockSupabase();
    signOut = mockClient.auth.signOut;
    // @ts-expect-error - モックオブジェクトは SupabaseClient の全インターフェースを実装しない
    vi.mocked(createClient).mockReturnValue(mockClient as ReturnType<typeof createClient>);
  });

  it("端末側のキャッシュを両方とも破棄する", async () => {
    await clickLogout();

    await waitFor(() => expect(clearCachedHousehold).toHaveBeenCalled());
    expect(clearPersistedQueryCache).toHaveBeenCalled();
  });

  it("React Query の in-memory キャッシュを破棄する", async () => {
    const clearSpy = vi.spyOn(QueryClient.prototype, "clear");

    await clickLogout();

    await waitFor(() => expect(clearSpy).toHaveBeenCalled());
    clearSpy.mockRestore();
  });

  it("Supabase からサインアウトしてログイン画面へ遷移する", async () => {
    await clickLogout();

    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(mockRouter.push).toHaveBeenCalledWith("/login");
  });

  it("キャッシュ破棄は signOut より先に行う", async () => {
    const order: string[] = [];
    vi.mocked(clearCachedHousehold).mockImplementation(() => { order.push("clearCachedHousehold"); });
    vi.mocked(clearPersistedQueryCache).mockImplementation(() => { order.push("clearPersistedQueryCache"); });
    signOut.mockImplementation(async () => { order.push("signOut"); return { error: null }; });

    await clickLogout();

    await waitFor(() => expect(order).toContain("signOut"));
    // -1 同士の比較で素通りしないよう、まず 3 つとも呼ばれたことを確かめる
    expect(order).toEqual(
      expect.arrayContaining(["clearCachedHousehold", "clearPersistedQueryCache", "signOut"])
    );
    expect(order.indexOf("clearCachedHousehold")).toBeLessThan(order.indexOf("signOut"));
    expect(order.indexOf("clearPersistedQueryCache")).toBeLessThan(order.indexOf("signOut"));
  });
});
