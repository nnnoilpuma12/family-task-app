import * as dns from "node:dns";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isPublicPushAddress,
  isValidPushEndpoint,
  pushHttpsAgent,
  resolvePublicPushHost,
} from "@/lib/push-endpoint";

vi.mock("node:dns", () => ({ promises: { lookup: vi.fn() } }));

describe("push endpoint protection", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    "http://push.example.com/abc",
    "https://127.0.0.1/abc",
    "https://[::1]/abc",
    "https://push.example.com:8443/abc",
    "https://push.example.com.local/abc",
    "https://user@push.example.com/abc",
    "https://push.example.com/abc#fragment",
  ])("rejects an unsafe URL: %s", (endpoint) => {
    expect(isValidPushEndpoint(endpoint)).toBe(false);
  });

  it("accepts a public HTTPS push endpoint", () => {
    expect(isValidPushEndpoint("https://push.example.com/subscription/abc")).toBe(true);
    expect(pushHttpsAgent.options.lookup).toBeTypeOf("function");
  });

  it.each([
    "0.0.0.0", "10.2.3.4", "100.64.1.1", "127.0.0.1", "172.16.0.1",
    "192.168.1.1", "169.254.1.1", "198.18.0.1", "224.0.0.1",
    "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "2002:0a00:0001::1",
  ])("rejects a non-public DNS result: %s", (address) => {
    expect(isPublicPushAddress(address)).toBe(false);
  });

  it("rejects a mixed public/private DNS answer before opening a socket", async () => {
    // @ts-expect-error Vitest infers the single-address overload, but the call uses { all: true }.
    vi.mocked(dns.promises.lookup).mockResolvedValueOnce([
      { address: "8.8.8.8", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    await expect(resolvePublicPushHost("push.example.com")).rejects.toThrow("non-public");
  });

  it("pins a public DNS answer for the HTTPS agent", async () => {
    // @ts-expect-error Vitest infers the single-address overload, but the call uses { all: true }.
    vi.mocked(dns.promises.lookup).mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }]);
    await expect(resolvePublicPushHost("push.example.com")).resolves.toEqual({ address: "8.8.8.8", family: 4 });
  });
});
