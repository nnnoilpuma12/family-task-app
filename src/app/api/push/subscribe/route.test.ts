import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST, DELETE } from "@/app/api/push/subscribe/route";
import { createMockSupabase } from "@/test/mocks/supabase";

const mocks = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => mocks.client }));

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/test";
const subscription = { endpoint: ENDPOINT, keys: { p256dh: "public-key", auth: "auth-key" } };

function request(method: string, body: unknown, raw?: string) {
  return new Request("http://localhost/api/push/subscribe", {
    method,
    headers: { "Content-Type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

describe("/api/push/subscribe", () => {
  let client: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    client = createMockSupabase({ push_subscriptions: {} });
    mocks.client = client;
  });

  it.each([POST, DELETE])("未認証では本文の解析前に拒否し、DB を操作しない", async (handler) => {
    client.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const response = await handler(request(handler === POST ? "POST" : "DELETE", null, "{"));
    expect(response.status).toBe(401);
    expect(client.from).not.toHaveBeenCalled();
  });

  it.each([POST, DELETE])("不正な JSON は 400 を返し、DB を操作しない", async (handler) => {
    const response = await handler(request(handler === POST ? "POST" : "DELETE", null, "{"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON" });
    expect(client.from).not.toHaveBeenCalled();
  });

  it.each([
    null, [], "subscription", {},
    { ...subscription, endpoint: "https://127.0.0.1/internal" },
    { ...subscription, endpoint: "http://push.example.com/test" },
    { ...subscription, keys: null },
    { ...subscription, keys: { p256dh: "", auth: "key" } },
    { ...subscription, keys: { p256dh: 123, auth: "key" } },
    { ...subscription, keys: { p256dh: "key", auth: {} } },
    { ...subscription, keys: { p256dh: "key" } },
  ].map((body) => ({ body })))("POST は不正な購読 $body を保存しない", async ({ body }) => {
    const response = await POST(request("POST", body));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid subscription" });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("POST は認証ユーザーの ID を使い、同じ endpoint の購読を更新する", async () => {
    const response = await POST(request("POST", { ...subscription, profile_id: "other-user" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(client.from).toHaveBeenCalledWith("push_subscriptions");
    expect(client._table("push_subscriptions").upsert).toHaveBeenCalledWith({
      profile_id: "user-1", endpoint: ENDPOINT, p256dh: "public-key", auth: "auth-key",
    }, { onConflict: "endpoint" });
  });

  it.each([null, [], {}, { endpoint: "" }, { endpoint: 123 }, { endpoint: {} }].map((body) => ({ body })))(
    "DELETE は不正な本文 $body で削除しない", async ({ body }) => {
      const response = await DELETE(request("DELETE", body));
      expect(response.status).toBe(400);
      expect(client.from).not.toHaveBeenCalled();
    }
  );

  it("DELETE は endpoint と認証ユーザーの両方で削除対象を絞る", async () => {
    const response = await DELETE(request("DELETE", { endpoint: ENDPOINT, profile_id: "other-user" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    const chain = client._table("push_subscriptions");
    expect(chain.delete).toHaveBeenCalledTimes(1);
    expect(chain.eq.mock.calls).toEqual([["endpoint", ENDPOINT], ["profile_id", "user-1"]]);
  });

  it.each([POST, DELETE])("DB エラーを成功として返さない", async (handler) => {
    client._table("push_subscriptions")._result = { data: null, error: { message: "DB unavailable" } };
    const response = await handler(request(handler === POST ? "POST" : "DELETE", subscription));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "DB unavailable" });
  });
});
