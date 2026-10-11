import { beforeEach, describe, expect, it, vi } from "vitest";
import { removeCurrentPushSubscription } from "@/lib/push-subscription";

describe("removeCurrentPushSubscription", () => {
  const unsubscribe = vi.fn().mockResolvedValue(true);
  const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/test", unsubscribe };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) } }) },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
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
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    await expect(removeCurrentPushSubscription()).rejects.toThrow("購読の削除に失敗しました");
    expect(unsubscribe).toHaveBeenCalled();
  });
});
