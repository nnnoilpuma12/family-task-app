import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createQueryRefresh } from "@/lib/query-refresh";

afterEach(() => vi.useRealTimers());

function harness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const key = ["tasks", "household"];
  client.setQueryData(key, ["cached"]);
  const responses: Array<(data: string[]) => void> = [];
  const fetch = vi.fn(() => new Promise<string[]>((resolve) => responses.push(resolve)));
  const observer = new QueryObserver(client, { queryKey: key, queryFn: fetch, staleTime: Infinity });
  const unsubscribe = observer.subscribe(() => {});
  const refresh = createQueryRefresh(client, key, 50);
  return { client, key, responses, fetch, observer, refresh, cleanup: () => {
    refresh.cancel(); unsubscribe(); client.clear();
  } };
}

describe("query refresh", () => {
  it("購読成立・画面復帰・online が重なっても取得は1回", async () => {
    vi.useFakeTimers();
    const h = harness();
    h.refresh.request(); h.refresh.request(); h.refresh.request();
    await vi.advanceTimersByTimeAsync(50);
    expect(h.fetch).toHaveBeenCalledTimes(1);
    h.responses[0](["fresh"]);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.client.getQueryData(h.key)).toEqual(["fresh"]);
    h.cleanup();
  });

  it("購読前の取得が進行中なら、終了後に新しいスナップショットを1回取得", async () => {
    vi.useFakeTimers();
    const h = harness();
    const initial = h.observer.refetch();
    h.refresh.request();
    await vi.advanceTimersByTimeAsync(50);
    h.refresh.request(); // 待機中の別の再同期もまとめる
    await vi.advanceTimersByTimeAsync(50);
    expect(h.fetch).toHaveBeenCalledTimes(1);
    h.responses[0](["before subscription"]);
    await initial;
    await vi.advanceTimersByTimeAsync(0);
    expect(h.fetch).toHaveBeenCalledTimes(2);
    h.responses[1](["missed change"]);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.client.getQueryData(h.key)).toEqual(["missed change"]);
    h.cleanup();
  });

  it("再取得中の変更は取りこぼさず、次の1回にまとめる", async () => {
    vi.useFakeTimers();
    const h = harness();
    h.refresh.request();
    await vi.advanceTimersByTimeAsync(50);
    h.refresh.request(); h.refresh.request();
    await vi.advanceTimersByTimeAsync(50);
    expect(h.fetch).toHaveBeenCalledTimes(1);
    h.responses[0](["old"]);
    await vi.advanceTimersByTimeAsync(50);
    expect(h.fetch).toHaveBeenCalledTimes(2);
    h.responses[1](["new"]);
    await vi.advanceTimersByTimeAsync(50);
    expect(h.fetch).toHaveBeenCalledTimes(2);
    h.cleanup();
  });

  it("世帯切替・アンマウント時に待機中の取得を残さない", async () => {
    vi.useFakeTimers();
    const h = harness();
    const initial = h.observer.refetch();
    h.refresh.request();
    await vi.advanceTimersByTimeAsync(50);
    h.refresh.cancel();
    h.responses[0](["old household"]);
    await initial;
    await vi.advanceTimersByTimeAsync(100);
    expect(h.fetch).toHaveBeenCalledTimes(1);
    h.cleanup();
  });
});
