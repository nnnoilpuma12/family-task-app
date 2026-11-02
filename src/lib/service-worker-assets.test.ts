// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(`${process.cwd()}/public/sw.js`, "utf8");

function worker() {
  const listeners = new Map<string, (event: unknown) => void>();
  const staleResponse = new Response("old image");
  const match = vi.fn().mockResolvedValue(staleResponse);
  const fetch = vi.fn();
  runInNewContext(source, {
    self: {
      location: { origin: "https://app.example" },
      addEventListener: (name: string, listener: (event: unknown) => void) => listeners.set(name, listener),
    },
    caches: { match },
    fetch, URL,
  });
  const respondWith = vi.fn();
  function request(path: string) {
    listeners.get("fetch")?.({
      request: new Request(`https://app.example${path}`),
      respondWith,
    });
  }
  return { request, respondWith, match, fetch, staleResponse };
}

describe("service worker installation assets", () => {
  it.each([
    "/manifest.json",
    "/manifest.json?v=4",
    "/icon-192x192.png?v=4",
    "/icon-512x512.png?v=4",
    "/icon-maskable-192x192.png?v=3",
    "/icon-maskable-512x512.png?v=3",
    "/icon-badge.png?v=3",
    "/apple-touch-icon.png?v=3",
    "/favicon.png?v=4",
    "/favicon.ico",
  ])("lets HTTP revalidate %s even when the worker has a stale image", (path) => {
    const sw = worker();
    sw.request(path);
    expect(sw.respondWith).not.toHaveBeenCalled();
    expect(sw.match).not.toHaveBeenCalled();
    expect(sw.fetch).not.toHaveBeenCalled();
  });

  it.each(["/_next/static/chunks/app.js", "/notification-avatars/cat.png?v=1"])
    ("still serves cached app resources offline: %s", async (path) => {
      const sw = worker();
      sw.request(path);
      expect(sw.respondWith).toHaveBeenCalledOnce();
      expect(await sw.respondWith.mock.calls[0]?.[0]).toBe(sw.staleResponse);
      expect(sw.fetch).not.toHaveBeenCalled();
    });
});
