import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/client-error/route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server");

function request(body: unknown) {
  return new Request("http://localhost/api/client-error", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("client error reporting", () => {
  beforeEach(() => vi.clearAllMocks());

  it("未認証の報告を拒否する", async () => {
    vi.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } } as never);
    expect((await POST(request({ name: "TypeError", digest: null, path: "/" }))).status).toBe(401);
  });

  it("許可した小さな項目だけを構造化ログに記録する", async () => {
    vi.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "reporter" } } }) } } as never);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(request({ name: "TypeError", digest: "abc", path: "/settings" }));
    expect(response.status).toBe(204);
    expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual({
      event: "client_error", name: "TypeError", digest: "abc", path: "/settings",
    });
    log.mockRestore();
  });

  it("過大な報告を拒否する", async () => {
    vi.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "reporter-2" } } }) } } as never);
    expect((await POST(request({ name: "X".repeat(3000), digest: null, path: "/" }))).status).toBe(413);
  });
});
