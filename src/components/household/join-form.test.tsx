import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { JoinHouseholdForm } from "@/components/household/join-form";
import { createClient } from "@/lib/supabase/client";
import { clearCachedHousehold } from "@/lib/household-cache";
import { clearPersistedQueryCache } from "@/lib/query-persist";
import { createMockSupabase } from "@/test/mocks/supabase";

/**
 * 世帯参加は「前世帯のデータを端末に残さない」境界。
 * CLAUDE.md が clearCachedHousehold + clearPersistedQueryCache の
 * 呼び出しを必須ルールとして定めているため、ここで固定する。
 */

vi.mock("@/lib/supabase/client");
vi.mock("@/lib/household-cache", () => ({ clearCachedHousehold: vi.fn() }));
vi.mock("@/lib/query-persist", () => ({ clearPersistedQueryCache: vi.fn() }));

const mockRouter = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/household/join",
}));

// 招待コードは gen_random_bytes(8) の 16 文字 hex（005_strengthen_invite_code.sql）
const VALID_CODE = "a1b2c3d4e5f60718";
const JOINED_HOUSEHOLD_ID = "household-2";

let mockClient: ReturnType<typeof createMockSupabase>;

function setupClient(rpcResult: { data: unknown; error: unknown }) {
  mockClient = createMockSupabase();
  mockClient.rpc.mockResolvedValue(rpcResult);
  // @ts-expect-error - モックオブジェクトは SupabaseClient の全インターフェースを実装しない
  vi.mocked(createClient).mockReturnValue(mockClient as ReturnType<typeof createClient>);
}

async function submitCode(code: string) {
  const user = userEvent.setup();
  render(<JoinHouseholdForm />);
  await user.type(screen.getByLabelText("招待コード"), code);
  await user.click(screen.getByRole("button", { name: "ハウスホールドに参加" }));
}

describe("JoinHouseholdForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("参加成功", () => {
    beforeEach(() => {
      setupClient({ data: JOINED_HOUSEHOLD_ID, error: null });
    });

    it("join_household_with_code RPC を大文字化したコードで呼ぶ", async () => {
      await submitCode(VALID_CODE);

      await waitFor(() =>
        expect(mockClient.rpc).toHaveBeenCalledWith("join_household_with_code", {
          p_code: VALID_CODE.toUpperCase(),
        })
      );
    });

    it("前世帯のキャッシュを両方とも破棄する", async () => {
      await submitCode(VALID_CODE);

      await waitFor(() => expect(clearCachedHousehold).toHaveBeenCalled());
      expect(clearPersistedQueryCache).toHaveBeenCalled();
    });

    it("ホームへ遷移する", async () => {
      await submitCode(VALID_CODE);

      await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/"));
    });
  });

  describe("参加失敗", () => {
    it("RPC がエラーならエラー文言を出し、キャッシュを消さない", async () => {
      setupClient({ data: null, error: { message: "invalid code" } });

      await submitCode(VALID_CODE);

      expect(await screen.findByText("招待コードが無効か期限切れです")).toBeInTheDocument();
      expect(clearCachedHousehold).not.toHaveBeenCalled();
      expect(clearPersistedQueryCache).not.toHaveBeenCalled();
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it("householdId が返らない場合もエラー扱いにする", async () => {
      setupClient({ data: null, error: null });

      await submitCode(VALID_CODE);

      expect(await screen.findByText("招待コードが無効か期限切れです")).toBeInTheDocument();
      expect(clearPersistedQueryCache).not.toHaveBeenCalled();
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });

  describe("入力検証", () => {
    it("16 文字未満では送信ボタンが押せない", async () => {
      setupClient({ data: JOINED_HOUSEHOLD_ID, error: null });
      const user = userEvent.setup();
      render(<JoinHouseholdForm />);

      await user.type(screen.getByLabelText("招待コード"), "a1b2c3");

      expect(screen.getByRole("button", { name: "ハウスホールドに参加" })).toBeDisabled();
      expect(mockClient.rpc).not.toHaveBeenCalled();
    });
  });
});
