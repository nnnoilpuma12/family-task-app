import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/auth/callback/route";

const mocks = vi.hoisted(() => ({
  exchange: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

const ORIGIN = "https://family.example";
function request(code: string | null, next?: string) {
  const url = new URL("/auth/callback", ORIGIN);
  if (code !== null) url.searchParams.set("code", code);
  if (next !== undefined) url.searchParams.set("next", next);
  return new Request(url);
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exchange.mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ auth: { exchangeCodeForSession: mocks.exchange } });
  });

  it.each([undefined, "/", "/reset-password", "/settings?tab=profile"])(
    "コード交換後にアプリ内の %s へ遷移する", async (next) => {
      const response = await GET(request("auth-code", next));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(`${ORIGIN}${next ?? "/"}`);
      expect(mocks.exchange).toHaveBeenCalledTimes(1);
      expect(mocks.exchange).toHaveBeenCalledWith("auth-code");
    }
  );

  it.each(["https://evil.example/", "//evil.example/", "javascript:alert(1)", "settings", ""])(
    "外部 URL や相対パス %s はホームへ戻す", async (next) => {
      const response = await GET(request("auth-code", next));
      expect(response.headers.get("location")).toBe(`${ORIGIN}/`);
    }
  );

  it.each([null, ""])("コード %s がなければ交換せずログインへ戻す", async (code) => {
    const response = await GET(request(code, "/reset-password"));
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login?error=auth_failed`);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("コード交換失敗では指定された遷移先へ進まない", async () => {
    mocks.exchange.mockResolvedValueOnce({ error: new Error("expired code") });
    const response = await GET(request("expired-code", "/reset-password"));
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login?error=auth_failed`);
  });
});
