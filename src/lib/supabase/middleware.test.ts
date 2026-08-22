import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * updateSession はアプリ全ページのアクセス制御を担う。
 * ここが壊れると「全員ログインできない」か「未ログインで中身が見える」の
 * どちらかになるため、リダイレクトの両方向を固定しておく。
 */

const mocks = vi.hoisted(() => ({
  claims: null as { sub: string } | null,
}));

// getClaims は「未ログイン」を data: null で返す（getUser の data.user: null ではない）。
// 認証判定がこの形を取り違えると全員がログイン扱いになるため、返り値の形も含めて固定する。
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getClaims: async () =>
        mocks.claims === null
          ? { data: null, error: null }
          : { data: { claims: mocks.claims }, error: null },
    },
  }),
}));

const PUBLIC_PATHS = ["/login", "/signup", "/auth/callback", "/forgot-password"];
const PROTECTED_PATHS = ["/", "/settings", "/household/new", "/household/join"];

function makeRequest(pathname: string) {
  return new NextRequest(new URL(`http://localhost${pathname}`));
}

function locationOf(response: Response) {
  const location = response.headers.get("location");
  return location === null ? null : new URL(location).pathname;
}

describe("updateSession", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    mocks.claims = null;
  });

  describe("未ログイン", () => {
    it.each(PROTECTED_PATHS)("%s へのアクセスは /login にリダイレクトする", async (path) => {
      mocks.claims = null;

      const res = await updateSession(makeRequest(path));

      expect(locationOf(res)).toBe("/login");
    });

    it.each(PUBLIC_PATHS)("%s はリダイレクトせず通す", async (path) => {
      mocks.claims = null;

      const res = await updateSession(makeRequest(path));

      expect(locationOf(res)).toBeNull();
    });
  });

  describe("ログイン済み", () => {
    // 現行挙動の固定であって、望ましい仕様の宣言ではない。
    // /auth/callback もここに含まれるため、ログイン済みのまま
    // パスワード再設定リンクを踏むと code 交換の前に / へ飛ばされる
    // （= /reset-password に辿り着けない）。修正は別 PR で扱う。
    it.each(PUBLIC_PATHS)("%s へのアクセスは / にリダイレクトする", async (path) => {
      mocks.claims = { sub: "user-1" };

      const res = await updateSession(makeRequest(path));

      expect(locationOf(res)).toBe("/");
    });

    it.each(PROTECTED_PATHS)("%s はリダイレクトせず通す", async (path) => {
      mocks.claims = { sub: "user-1" };

      const res = await updateSession(makeRequest(path));

      expect(locationOf(res)).toBeNull();
    });
  });

  describe("リダイレクト先の組み立て", () => {
    it("クエリ文字列を保持したまま /login へ送る", async () => {
      mocks.claims = null;

      const res = await updateSession(makeRequest("/settings?tab=push"));
      const location = res.headers.get("location");

      expect(location).not.toBeNull();
      const url = new URL(location ?? "");
      expect(url.pathname).toBe("/login");
      expect(url.searchParams.get("tab")).toBe("push");
    });

    it("/reset-password は公開パスに含まれないため未ログインでは弾かれる", async () => {
      mocks.claims = null;

      const res = await updateSession(makeRequest("/reset-password"));

      // リセットリンクは /auth/callback でセッションを張ってから遷移する前提
      expect(locationOf(res)).toBe("/login");
    });
  });
});
