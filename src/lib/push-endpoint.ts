import * as dns from "node:dns";
import https from "node:https";
import { BlockList, isIP } from "node:net";

const MAX_ENDPOINT_LENGTH = 2048;

// Block both local networks and special-use addresses. The final DNS address
// is checked by the HTTPS agent, so a hostname cannot pass validation and then
// resolve to an internal service when the request is made.
const blockedIPv4 = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blockedIPv4.addSubnet(address, prefix, "ipv4");

const globalIPv6 = new BlockList();
globalIPv6.addSubnet("2000::", 3, "ipv6");
const blockedIPv6 = new BlockList();
for (const [address, prefix] of [
  ["2001::", 32], // Teredo
  ["2001:db8::", 32], // Documentation
  ["2002::", 16], // 6to4, which can embed a private IPv4 address
] as const) blockedIPv6.addSubnet(address, prefix, "ipv6");

export function isPublicPushAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedIPv4.check(address, "ipv4");
  if (family === 6) {
    return globalIPv6.check(address, "ipv6") && !blockedIPv6.check(address, "ipv6");
  }
  return false;
}

export function isValidPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > MAX_ENDPOINT_LENGTH) return false;
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:"
      && url.port === ""
      && url.username === ""
      && url.password === ""
      && url.hash === ""
      && host !== "localhost"
      && !host.endsWith(".localhost")
      && !host.endsWith(".local")
      && !host.endsWith(".internal")
      && isIP(host) === 0
      && !host.includes(":");
  } catch {
    return false;
  }
}

export async function resolvePublicPushHost(hostname: string) {
  const addresses = await dns.promises.lookup(hostname, { all: true });
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicPushAddress(address))) {
    throw new Error("Push endpoint resolved to a non-public address");
  }
  return addresses[0];
}

export const pushHttpsAgent = new https.Agent({
  lookup(hostname, _options, callback) {
    void resolvePublicPushHost(hostname).then(
      ({ address, family }) => callback(null, address, family),
      (error: unknown) => callback(error instanceof Error ? error : new Error("Push DNS lookup failed"), "", 4)
    );
  },
  autoSelectFamily: false,
});
