import { describe, it, expect } from "vitest";
import { isValidUrl } from "@/lib/validation";

describe("isValidUrl", () => {
  it("https:// URL は有効", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
  });

  it("http:// URL は有効", () => {
    expect(isValidUrl("http://example.com")).toBe(true);
  });

  it("パス・クエリを含む URL は有効", () => {
    expect(isValidUrl("https://example.com/path?q=1#hash")).toBe(true);
  });

  it("プロトコルなしのベアドメインは無効", () => {
    expect(isValidUrl("example.com")).toBe(false);
  });

  it("javascript: スキームは無効", () => {
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
  });

  it("data: スキームは無効", () => {
    expect(isValidUrl("data:text/html,<h1>hi</h1>")).toBe(false);
  });

  it("ftp:// は無効", () => {
    expect(isValidUrl("ftp://files.example.com")).toBe(false);
  });

  it("空文字は無効", () => {
    expect(isValidUrl("")).toBe(false);
  });

  it("スペースのみは無効", () => {
    expect(isValidUrl("   ")).toBe(false);
  });
});
