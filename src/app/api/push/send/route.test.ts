import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockSupabase } from "@/test/mocks/supabase";

/**
 * push/send は service_role を使い RLS をバイパスするため、
 * 認可チェックはこの Route Handler 自身が担っている。
 * 401 / 429 / 403 / 410 の各分岐がこのテストの主対象。
 */

const mocks = vi.hoisted(() => ({
  server: null as unknown,
  admin: null as unknown,
  adminThrows: false,
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...args: unknown[]) => mocks.setVapidDetails(...args),
    sendNotification: (...args: unknown[]) => mocks.sendNotification(...args),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mocks.server,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => {
    if (mocks.adminThrows) throw new Error("service role key missing");
    return mocks.admin;
  },
}));

const HOUSEHOLD_ID = "household-1";
const SENDER_ID = "user-1";

type Subscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
  profile_id: string;
};

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    endpoint: "https://push.example.com/ep-1",
    p256dh: "p256dh-key",
    auth: "auth-key",
    profile_id: "user-2",
    ...overrides,
  };
}

/** リクエスト元（通常権限）クライアント */
function buildServerClient({
  userId = SENDER_ID as string | null,
  senderHouseholdId = HOUSEHOLD_ID as string | null,
} = {}) {
  const client = createMockSupabase({ profiles: {} });
  client.auth.getUser.mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: null,
  });
  client._table("profiles").single.mockResolvedValue({
    data: senderHouseholdId === null ? null : { household_id: senderHouseholdId },
    error: null,
  });
  return client;
}

/** service_role クライアント */
function buildAdminClient({
  members = [{ id: "user-2" }] as { id: string }[],
  subscriptions = [makeSubscription()] as Subscription[],
} = {}) {
  return createMockSupabase({
    profiles: { data: members },
    push_subscriptions: { data: subscriptions },
  });
}

function makeRequest(body: unknown, rawBody?: string) {
  return new Request("http://localhost/api/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody ?? JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return { title: "家族タスク", body: "「掃除」が追加されました", householdId: HOUSEHOLD_ID, ...overrides };
}

async function loadPost() {
  const mod = await import("@/app/api/push/send/route");
  return mod.POST;
}

describe("POST /api/push/send", () => {
  beforeEach(() => {
    // vapidConfigured / rateLimitMap がモジュールレベル state のためテストごとに作り直す
    vi.resetModules();
    vi.clearAllMocks();

    process.env.VAPID_SUBJECT = "mailto:test@example.com";
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public-key";
    process.env.VAPID_PRIVATE_KEY = "test-private-key";

    mocks.adminThrows = false;
    mocks.sendNotification.mockResolvedValue(undefined);
    mocks.server = buildServerClient();
    mocks.admin = buildAdminClient();

    // ルートが出す運用ログでテスト出力が埋まるのを防ぐ
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("設定", () => {
    it("VAPID 環境変数が無ければ 500 を返し送信しない", async () => {
      delete process.env.VAPID_SUBJECT;

      const POST = await loadPost();
      const res = await POST(makeRequest(validBody()));

      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toEqual({
        error: "Push notifications not configured",
      });
      expect(mocks.sendNotification).not.toHaveBeenCalled();
    });

    it("service_role クライアントを作れなければ 500 を返す", async () => {
      mocks.adminThrows = true;

      const POST = await loadPost();
      const res = await POST(makeRequest(validBody()));

      expect(res.status).toBe(500);
      expect(mocks.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe("認証", () => {
    it("未ログインなら 401 を返す", async () => {
      mocks.server = buildServerClient({ userId: null });

      const POST = await loadPost();
      const res = await POST(makeRequest(validBody()));

      expect(res.status).toBe(401);
      expect(mocks.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe("認可（世帯スコープ）", () => {
    it("他世帯宛の送信は 403 で拒否する", async () => {
      // 送信者は household-1 所属だが、body は household-2 宛
      mocks.server = buildServerClient({ senderHouseholdId: HOUSEHOLD_ID });

      const POST = await loadPost();
      const res = await POST(makeRequest(validBody({ householdId: "household-2" })));

      expect(res.status).toBe(403);
      await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
      expect(mocks.sendNotification).not.toHaveBeenCalled();
    });

    it("プロフィールが取得できなければ 403 を返す", async () => {
      mocks.server = buildServerClient({ senderHouseholdId: null });

      const POST = await loadPost();
      const res = await POST(makeRequest(validBody()));

      expect(res.status).toBe(403);
      expect(mocks.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe("リクエスト検証", () => {
    it("JSON として不正なら 400 を返す", async () => {
      const POST = await loadPost();
      const res = await POST(makeRequest(null, "{壊れた JSON"));

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({ error: "Invalid JSON" });
    });

    it.each([
      ["title", { title: undefined }],
      ["body", { body: undefined }],
      ["householdId", { householdId: undefined }],
    ])("%s が欠けていれば 400 を返す", async (_name, missing) => {
      const POST = await loadPost();
      const res = await POST(makeRequest(validBody(missing)));

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({ error: "Missing required fields" });
    });

    it("title は 200 文字、body は 500 文字に切り詰める", async () => {
      const POST = await loadPost();
      const res = await POST(
        makeRequest(validBody({ title: "あ".repeat(300), body: "い".repeat(800) }))
      );

      expect(res.status).toBe(200);
      const payload = JSON.parse(mocks.sendNotification.mock.calls[0][1] as string);
      expect(payload.title).toHaveLength(200);
      expect(payload.body).toHaveLength(500);
    });
  });

  describe("レート制限", () => {
    it("同一ユーザーの 11 回目は 429 を返す", async () => {
      const POST = await loadPost();

      for (let i = 0; i < 10; i++) {
        const ok = await POST(makeRequest(validBody()));
        expect(ok.status).toBe(200);
      }

      const limited = await POST(makeRequest(validBody()));
      expect(limited.status).toBe(429);
      await expect(limited.json()).resolves.toEqual({ error: "Too many requests" });
    });

    it("ウィンドウ（60 秒）が明けたら再び送信できる", async () => {
      // Date だけを差し替える。setTimeout まで止めると await が進まなくなる
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-08-14T00:00:00Z"));

      const POST = await loadPost();
      for (let i = 0; i < 10; i++) {
        await POST(makeRequest(validBody()));
      }
      expect((await POST(makeRequest(validBody()))).status).toBe(429);

      vi.setSystemTime(new Date("2026-08-14T00:01:01Z"));

      expect((await POST(makeRequest(validBody()))).status).toBe(200);
      vi.useRealTimers();
    });

    it("別ユーザーは互いのレート制限に影響しない", async () => {
      const POST = await loadPost();

      for (let i = 0; i < 10; i++) {
        await POST(makeRequest(validBody()));
      }
      expect((await POST(makeRequest(validBody()))).status).toBe(429);

      mocks.server = buildServerClient({ userId: "user-99" });
      expect((await POST(makeRequest(validBody()))).status).toBe(200);
    });
  });

  describe("送信", () => {
    it("自分以外の世帯メンバーの購読へ送る", async () => {
      const subs = [
        makeSubscription({ endpoint: "https://push.example.com/a", profile_id: "user-2" }),
        makeSubscription({ endpoint: "https://push.example.com/b", profile_id: "user-3" }),
      ];
      mocks.admin = buildAdminClient({
        members: [{ id: "user-2" }, { id: "user-3" }],
        subscriptions: subs,
      });

      const POST = await loadPost();
      const res = await POST(makeRequest(validBody()));

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ success: true, sent: 2 });

      // 送信者自身を除外して世帯メンバーを引いている
      const adminClient = mocks.admin as ReturnType<typeof createMockSupabase>;
      expect(adminClient._table("profiles").eq).toHaveBeenCalledWith("household_id", HOUSEHOLD_ID);
      expect(adminClient._table("profiles").neq).toHaveBeenCalledWith("id", SENDER_ID);

      expect(mocks.sendNotification).toHaveBeenCalledTimes(2);
      expect(mocks.sendNotification.mock.calls[0][0]).toEqual({
        endpoint: "https://push.example.com/a",
        keys: { p256dh: "p256dh-key", auth: "auth-key" },
      });
    });

    it("世帯に他メンバーがいなければ sent: 0 で送信しない", async () => {
      mocks.admin = buildAdminClient({ members: [] });

      const POST = await loadPost();
      const res = await POST(makeRequest(validBody()));

      await expect(res.json()).resolves.toEqual({ success: true, sent: 0 });
      expect(mocks.sendNotification).not.toHaveBeenCalled();
    });

    it("購読が無ければ sent: 0 で送信しない", async () => {
      mocks.admin = buildAdminClient({ subscriptions: [] });

      const POST = await loadPost();
      const res = await POST(makeRequest(validBody()));

      await expect(res.json()).resolves.toEqual({ success: true, sent: 0 });
      expect(mocks.sendNotification).not.toHaveBeenCalled();
    });

    it("一部が失敗しても成功分だけを sent として返す", async () => {
      mocks.admin = buildAdminClient({
        members: [{ id: "user-2" }, { id: "user-3" }],
        subscriptions: [
          makeSubscription({ endpoint: "https://push.example.com/ok" }),
          makeSubscription({ endpoint: "https://push.example.com/ng" }),
        ],
      });
      mocks.sendNotification
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce({ statusCode: 500, body: "server error" });

      const POST = await loadPost();
      const res = await POST(makeRequest(validBody()));

      await expect(res.json()).resolves.toEqual({ success: true, sent: 1 });
    });

    it("410 Gone の購読は push_subscriptions から削除する", async () => {
      const deadEndpoint = "https://push.example.com/gone";
      mocks.admin = buildAdminClient({
        subscriptions: [makeSubscription({ endpoint: deadEndpoint })],
      });
      mocks.sendNotification.mockRejectedValue({ statusCode: 410, body: "Gone" });

      const POST = await loadPost();
      const res = await POST(makeRequest(validBody()));

      await expect(res.json()).resolves.toEqual({ success: true, sent: 0 });

      const subsChain = (mocks.admin as ReturnType<typeof createMockSupabase>)._table(
        "push_subscriptions"
      );
      expect(subsChain.delete).toHaveBeenCalled();
      expect(subsChain.eq).toHaveBeenCalledWith("endpoint", deadEndpoint);
    });

    it("410 以外の失敗では購読を削除しない", async () => {
      mocks.sendNotification.mockRejectedValue({ statusCode: 500, body: "server error" });

      const POST = await loadPost();
      await POST(makeRequest(validBody()));

      const subsChain = (mocks.admin as ReturnType<typeof createMockSupabase>)._table(
        "push_subscriptions"
      );
      expect(subsChain.delete).not.toHaveBeenCalled();
    });
  });
});
