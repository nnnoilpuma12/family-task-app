// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_NOTIFICATION_ICON } from "@/lib/notification-icon";

const source = readFileSync(`${process.cwd()}/public/sw.js`, "utf8");
const ICON = "https://project.supabase.co/storage/v1/object/public/avatars/sender/photo.webp";

function worker() {
  const listeners = new Map<string, (event: unknown) => void>();
  const fetch = vi.fn<typeof globalThis.fetch>();
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const closeBitmap = vi.fn();
  const createImageBitmap = vi.fn().mockResolvedValue({ close: closeBitmap });
  runInNewContext(source, {
    self: {
      location: { origin: "https://app.example", protocol: "https:" },
      registration: { showNotification },
      addEventListener: (name: string, listener: (event: unknown) => void) => listeners.set(name, listener),
    },
    fetch, createImageBitmap, URL, AbortController, Uint8Array, btoa, setTimeout, clearTimeout,
  });
  function push(data: Record<string, unknown>) {
    let completion: Promise<void> | undefined;
    listeners.get("push")?.({
      data: { json: () => data },
      waitUntil: (promise: Promise<void>) => { completion = promise; },
    });
    if (!completion) throw new Error("Push did not extend the worker lifetime");
    return completion;
  }
  return { fetch, showNotification, createImageBitmap, closeBitmap, push };
}

function imageResponse() {
  return new Response("image-bytes", { headers: { "Content-Type": "image/webp" } });
}

afterEach(() => vi.useRealTimers());

describe("service worker push notification", () => {
  it.each([ICON, "/notification-avatars/cat.png?v=1"])("loads %s and embeds the decoded image", async (icon) => {
    const sw = worker();
    sw.fetch.mockResolvedValue(imageResponse());
    await sw.push({ title: "家族タスク", body: "追加しました", icon, url: "/" });
    expect(sw.fetch).toHaveBeenCalledWith(icon, expect.objectContaining({ credentials: "omit", redirect: "error" }));
    expect(sw.closeBitmap).toHaveBeenCalledOnce();
    expect(sw.showNotification).toHaveBeenCalledOnce();
    expect(sw.showNotification).toHaveBeenCalledWith("家族タスク", {
      body: "追加しました", icon: `data:image/webp;base64,${btoa("image-bytes")}`,
      badge: "/icon-badge.png?v=3", data: { url: "/" },
    });
  });

  it.each([undefined, null, DEFAULT_NOTIFICATION_ICON, "data:image/png;base64,AAA", "javascript:alert(1)"])
    ("shows legacy and invalid-icon notifications without downloading: %s", async (icon) => {
      const sw = worker();
      await sw.push({ icon });
      expect(sw.fetch).not.toHaveBeenCalled();
      expect(sw.showNotification).toHaveBeenCalledWith("家族タスク", expect.objectContaining({ icon: DEFAULT_NOTIFICATION_ICON }));
    });

  it.each(["network", "404", "html", "corrupt", "oversized"])("still notifies when an image fails: %s", async (failure) => {
    const sw = worker();
    if (failure === "network") sw.fetch.mockRejectedValue(new Error("Offline"));
    if (failure === "404") sw.fetch.mockResolvedValue(new Response(null, { status: 404 }));
    if (failure === "html") sw.fetch.mockResolvedValue(new Response("<html>login</html>", { headers: { "Content-Type": "text/html" } }));
    if (failure === "corrupt") {
      sw.fetch.mockResolvedValue(imageResponse());
      sw.createImageBitmap.mockRejectedValue(new Error("Cannot decode"));
    }
    if (failure === "oversized") sw.fetch.mockResolvedValue(new Response(new Uint8Array(2 * 1024 * 1024 + 1), { headers: { "Content-Type": "image/png" } }));
    await sw.push({ icon: ICON });
    expect(sw.showNotification).toHaveBeenCalledTimes(1);
    expect(sw.showNotification).toHaveBeenCalledWith("家族タスク", expect.objectContaining({ icon: DEFAULT_NOTIFICATION_ICON }));
  });

  it("limits image loading to three seconds even when the fetch never settles", async () => {
    vi.useFakeTimers();
    const sw = worker();
    sw.fetch.mockImplementation(() => new Promise(() => {}));
    const done = sw.push({ icon: ICON });
    await vi.advanceTimersByTimeAsync(2999);
    expect(sw.showNotification).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(sw.fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(sw.showNotification).toHaveBeenCalledOnce();
    expect(sw.showNotification).toHaveBeenCalledWith("家族タスク", expect.objectContaining({ icon: DEFAULT_NOTIFICATION_ICON }));
  });

  it("retries with the app icon if the browser rejects a custom image", async () => {
    const sw = worker();
    sw.fetch.mockResolvedValue(imageResponse());
    sw.showNotification.mockRejectedValueOnce(new Error("Unsupported icon"));
    await sw.push({ icon: ICON });
    expect(sw.showNotification).toHaveBeenCalledTimes(2);
    expect(sw.showNotification).toHaveBeenLastCalledWith("家族タスク", expect.objectContaining({ icon: DEFAULT_NOTIFICATION_ICON }));
  });
});
