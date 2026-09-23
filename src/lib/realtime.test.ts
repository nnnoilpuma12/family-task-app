import { describe, it, expect, vi, afterEach } from "vitest";
import { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { createSubscribeHandler } from "@/lib/realtime";

describe("createSubscribeHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("SUBSCRIBED で onResync を呼ぶ", () => {
    const onResync = vi.fn();
    const handler = createSubscribeHandler("tasks:h1", onResync);

    handler(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);

    expect(onResync).toHaveBeenCalledTimes(1);
  });

  it("SUBSCRIBED が再び来れば再度 onResync を呼ぶ（再接続後の rejoin を想定）", () => {
    const onResync = vi.fn();
    const handler = createSubscribeHandler("tasks:h1", onResync);

    handler(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
    handler(REALTIME_SUBSCRIBE_STATES.CLOSED);
    handler(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);

    expect(onResync).toHaveBeenCalledTimes(2);
  });

  it("CHANNEL_ERROR では onResync を呼ばず警告を残す", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onResync = vi.fn();
    const handler = createSubscribeHandler("tasks:h1", onResync);

    handler(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR, new Error("boom"));

    expect(onResync).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "[realtime] tasks:h1: CHANNEL_ERROR",
      expect.any(Error)
    );
  });

  it("TIMED_OUT でも onResync を呼ばず警告を残す", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onResync = vi.fn();
    const handler = createSubscribeHandler("staple_items:h1", onResync);

    handler(REALTIME_SUBSCRIBE_STATES.TIMED_OUT);

    expect(onResync).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("CLOSED は正常な切断なので何もしない", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onResync = vi.fn();
    const handler = createSubscribeHandler("tasks:h1", onResync);

    handler(REALTIME_SUBSCRIBE_STATES.CLOSED);

    expect(onResync).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("onResync 未指定でも例外にならない", () => {
    const handler = createSubscribeHandler("tasks:h1");
    expect(() => handler(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED)).not.toThrow();
  });
});
