import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePageData } from "@/hooks/use-page-data";
import { createClient } from "@/lib/supabase/client";
import { createMockSupabase } from "@/test/mocks/supabase";
import type { Household, Profile } from "@/types";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/supabase/client");

const mockRouter = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/",
}));

const HOUSEHOLD_ID = "household-1";
const USER_ID = "user-1";

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: USER_ID,
    household_id: HOUSEHOLD_ID,
    nickname: "テスト太郎",
    avatar_url: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: HOUSEHOLD_ID,
    name: "テスト家族",
    invite_code: "A1B2C3D4E5F60718",
    invite_code_expires_at: "2026-10-22T00:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function installClient({
  session = { user: { id: USER_ID, user_metadata: { nickname: "テスト太郎" } } } as object | null,
  profile = makeProfile() as Profile | null,
  profileError = null as { message: string } | null,
  createdProfile = null as Profile | null,
  household = makeHousehold(),
  members = [makeProfile()],
} = {}) {
  const client = createMockSupabase({
    profiles: { data: members },
    households: { data: household },
  });
  client.auth.getSession.mockResolvedValue({ data: { session }, error: null });
  client._table("profiles").maybeSingle.mockResolvedValue({ data: profile, error: profileError });
  client._table("profiles").single.mockResolvedValue({ data: createdProfile, error: null });
  client._table("households").single.mockResolvedValue({ data: household, error: null });
  vi.mocked(createClient).mockReturnValue(client as never);
  return client;
}

describe("usePageData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  it("セッションなしならログインへ戻す", async () => {
    installClient({ session: null });
    const { result } = renderHook(() => usePageData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockRouter.push).toHaveBeenCalledWith("/login");
    expect(result.current.profile).toBeNull();
  });

  it("プロフィール・世帯・メンバーをテーブル別に取得する", async () => {
    const profile = makeProfile();
    const partner = makeProfile({ id: "partner", nickname: "パートナー" });
    const household = makeHousehold();
    const client = installClient({ profile, household, members: [profile, partner] });

    const { result } = renderHook(() => usePageData({ fetchHousehold: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.profile).toEqual(profile);
    expect(result.current.household).toEqual(household);
    expect(result.current.householdName).toBe("テスト家族");
    expect(result.current.members).toEqual([profile, partner]);
    expect(client.from).toHaveBeenCalledWith("households");
  });

  it("未所属が確定したら作成画面へ進み、古い世帯を採用しない", async () => {
    localStorage.setItem(
      "family-task:household-cache",
      JSON.stringify({ id: "old-household", name: "以前の家族" })
    );
    installClient({ profile: makeProfile({ household_id: null }) });

    const { result } = renderHook(() => usePageData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.profile?.household_id).toBeNull();
    expect(result.current.householdName).toBe("家族タスク");
    expect(localStorage.getItem("family-task:household-cache")).toBeNull();
    expect(mockRouter.push).toHaveBeenCalledWith("/household/new");
  });

  it("プロフィール未作成の場合だけupsertする", async () => {
    const createdProfile = makeProfile({ household_id: null });
    const client = installClient({ profile: null, createdProfile });
    const { result } = renderHook(() => usePageData({ redirectIfNoHousehold: false }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(client._table("profiles").upsert).toHaveBeenCalled();
    expect(result.current.profile).toEqual(createdProfile);
  });

  it("プロフィール取得エラー時はupsertせず所属を推測しない", async () => {
    const { toast } = await import("sonner");
    const client = installClient({ profile: null, profileError: { message: "DB error" } });
    const { result } = renderHook(() => usePageData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(toast.error).toHaveBeenCalledWith("プロフィールの取得に失敗しました");
    expect(client._table("profiles").upsert).not.toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
  });

  it("フォーカス復帰時に世帯名とメンバーを再取得する", async () => {
    const client = installClient();
    const { result } = renderHook(() => usePageData({ fetchHousehold: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const updatedHousehold = makeHousehold({
      name: "更新後の家族",
      updated_at: "2026-10-21T01:00:00Z",
    });
    const partner = makeProfile({ id: "partner", nickname: "パートナー" });
    client._table("households").single.mockResolvedValue({ data: updatedHousehold, error: null });
    client._table("profiles")._result = { data: [makeProfile(), partner], error: null };

    await act(async () => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(result.current.householdName).toBe("更新後の家族"));
    expect(result.current.members).toHaveLength(2);
  });

  it("Realtimeの世帯更新を受けたらパートナー側の表示を更新する", async () => {
    const client = installClient();
    const { result } = renderHook(() => usePageData({ fetchHousehold: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(client.channel).toHaveBeenCalledTimes(1));

    client._table("households").single.mockResolvedValue({
      data: makeHousehold({ name: "リアルタイム更新" }),
      error: null,
    });
    const pageDataChannel = client.channel.mock.results[0].value;
    const realtimeCallback = pageDataChannel.on.mock.calls[1][2] as () => void;
    await act(async () => realtimeCallback());

    await waitFor(() => expect(result.current.householdName).toBe("リアルタイム更新"));
  });

  it("古い再取得レスポンスが新しい世帯状態を上書きしない", async () => {
    const client = installClient();
    const { result } = renderHook(() => usePageData({ fetchHousehold: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let releaseOld: (() => void) | undefined;
    const oldResponse = new Promise<{ data: { session: object }; error: null }>((resolve) => {
      releaseOld = () => resolve({ data: { session: { user: { id: USER_ID, user_metadata: {} } } }, error: null });
    });
    client.auth.getSession.mockReturnValueOnce(oldResponse as never);
    await act(async () => {
      void result.current.refresh();
      await Promise.resolve();
    });

    const newerHousehold = makeHousehold({ name: "最新の家族" });
    client._table("households").single.mockResolvedValue({ data: newerHousehold, error: null });
    await act(async () => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(result.current.householdName).toBe("最新の家族"));
    releaseOld?.();
    await act(async () => oldResponse);
    expect(result.current.householdName).toBe("最新の家族");
  });
});
