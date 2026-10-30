import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { removeCurrentPushSubscription } from "@/lib/push-subscription";

describe("removeCurrentPushSubscription", () => {
  const unsubscribe = vi.fn().mockResolvedValue(true);
  const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/test", unsubscribe };
  const getSubscription = vi.fn();
  const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

  beforeEach(() => {
    vi.clearAllMocks();
    unsubscribe.mockResolvedValue(true);
    getSubscription.mockResolvedValue(subscription);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager: { getSubscription } }) },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalServiceWorker) Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
    else Reflect.deleteProperty(navigator, "serviceWorker");
  });

  it("サーバーの購読行を削除してからブラウザの購読を解除する", async () => {
    await removeCurrentPushSubscription();
    expect(fetch).toHaveBeenCalledWith("/api/push/subscribe", expect.objectContaining({
      method: "DELETE",
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }));
    expect(vi.mocked(fetch).mock.invocationCallOrder[0]).toBeLessThan(unsubscribe.mock.invocationCallOrder[0]);
  });

  it("サーバーが失敗してもブラウザの購読を解除する", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(removeCurrentPushSubscription()).rejects.toThrow("購読の削除に失敗しました");
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("通信例外でもブラウザ側の購読を解除してからエラーを返す", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    await expect(removeCurrentPushSubscription()).rejects.toThrow("購読の削除に失敗しました");
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("購読が無ければ削除リクエストを送らない", async () => {
    getSubscription.mockResolvedValueOnce(null);
    await removeCurrentPushSubscription();
    expect(fetch).not.toHaveBeenCalled();
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it("Service Worker 非対応なら何もしない", async () => {
    // prototype 上の API も含めて非対応環境を再現する。
    vi.stubGlobal("navigator", {});
    await removeCurrentPushSubscription();
    expect(fetch).not.toHaveBeenCalled();
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it("ブラウザの解除失敗は成功扱いにしない", async () => {
    unsubscribe.mockResolvedValueOnce(false);
    await expect(removeCurrentPushSubscription()).rejects.toThrow("ブラウザの購読解除に失敗しました");
  });
});
