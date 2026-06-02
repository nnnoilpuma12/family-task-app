import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePageData } from "@/hooks/use-page-data";
import { createClient } from "@/lib/supabase/client";
import { MockQueryChain } from "@/test/mocks/supabase";
import type { Profile } from "@/types";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/supabase/client");

// setup.ts の mock を上書きし、安定した参照を持つ router を用意する
// (参照が毎 render で変わると useEffect の deps が変化して無限ループするため)
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

function makeSession(userId = USER_ID) {
  return {
    user: { id: userId, user_metadata: { nickname: "テスト太郎" } },
  };
}

// usePageData が行うクエリ呼び出し順に対応したモッククライアントを構築する
function buildMockClient({
  session = makeSession() as ReturnType<typeof makeSession> | null,
  profileData = makeProfile() as Profile | null,
  profileError = null as { message: string } | null,
  upsertProfileData = null as Profile | null,
  members = [] as Profile[],
} = {}) {
  // 1回目: from("profiles") → select...maybeSingle でプロフィール取得
  const profileFetchChain = new MockQueryChain();
  profileFetchChain.maybeSingle = vi.fn().mockResolvedValue({ data: profileData, error: profileError });

  // upsert 用チェーン（プロフィール未存在時に呼ばれる）
  const profileUpsertChain = new MockQueryChain();
  profileUpsertChain.single = vi.fn().mockResolvedValue({ data: upsertProfileData, error: null });

  // バックグラウンドメンバー取得チェーン（thenable）
  const membersFetchChain = new MockQueryChain();
  membersFetchChain._result = { data: members, error: null };

  // バックグラウンド世帯名取得チェーン
  const householdNameChain = new MockQueryChain();
  householdNameChain.single = vi.fn().mockResolvedValue({ data: { name: "テスト家族" }, error: null });

  const fromMock = vi.fn()
    .mockReturnValueOnce(profileFetchChain)   // profiles: マイプロフィール取得
    .mockReturnValueOnce(profileUpsertChain)  // profiles: upsert（未存在時のみ消費される）
    .mockReturnValueOnce(membersFetchChain)   // profiles: メンバー一覧
    .mockReturnValue(householdNameChain);     // households: 世帯名

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session },
        error: null,
      }),
    },
    from: fromMock,
  };
}

describe("usePageData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("セッションなし: /login へリダイレクトし loading が false になる", async () => {
    vi.mocked(createClient).mockReturnValue(
      buildMockClient({ session: null }) as any
    );

    const { result } = renderHook(() => usePageData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockRouter.push).toHaveBeenCalledWith("/login");
    expect(result.current.profile).toBeNull();
  });

  it("プロフィールあり・household_id あり: profile がセットされ loading が false になる", async () => {
    const profile = makeProfile();
    vi.mocked(createClient).mockReturnValue(
      buildMockClient({ profileData: profile }) as any
    );

    const { result } = renderHook(() => usePageData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.profile).toEqual(profile);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("household_id なし + redirectIfNoHousehold=true: /household/new へリダイレクト", async () => {
    const profile = makeProfile({ household_id: null });
    vi.mocked(createClient).mockReturnValue(
      buildMockClient({ profileData: profile }) as any
    );

    const { result } = renderHook(() => usePageData({ redirectIfNoHousehold: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockRouter.push).toHaveBeenCalledWith("/household/new");
    expect(result.current.profile).toEqual(profile);
  });

  it("household_id なし + redirectIfNoHousehold=false: リダイレクトしない", async () => {
    const profile = makeProfile({ household_id: null });
    vi.mocked(createClient).mockReturnValue(
      buildMockClient({ profileData: profile }) as any
    );

    const { result } = renderHook(() => usePageData({ redirectIfNoHousehold: false }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(result.current.profile).toEqual(profile);
  });

  it("プロフィール未存在: upsert で作成し profile がセットされる", async () => {
    const newProfile = makeProfile({ household_id: null });
    vi.mocked(createClient).mockReturnValue(
      buildMockClient({
        profileData: null,
        upsertProfileData: newProfile,
      }) as any
    );

    const { result } = renderHook(() => usePageData({ redirectIfNoHousehold: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.profile).toEqual(newProfile);
    // household_id が null なので /household/new へリダイレクト
    expect(mockRouter.push).toHaveBeenCalledWith("/household/new");
  });

  it("プロフィール取得エラー: toast.error が呼ばれる", async () => {
    const { toast } = await import("sonner");
    vi.mocked(createClient).mockReturnValue(
      buildMockClient({
        profileData: null,
        profileError: { message: "DB error" },
        upsertProfileData: makeProfile(),
      }) as any
    );

    renderHook(() => usePageData());
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalled();
    });
  });
});
