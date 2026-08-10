import { vi } from "vitest";
import type { createClient } from "@/lib/supabase/client";

export type MockResult = { data: unknown; error: unknown };

type SupabaseBrowserClient = ReturnType<typeof createClient>;

/**
 * モックオブジェクトを createClient の戻り値型として扱うためのヘルパ。
 * Supabase クライアントの全メソッドをモックで実装するのは非現実的なため、
 * テスト内でのみ使う意図的なダウンキャスト（`any` は使わない）。
 */
export function asSupabaseClient(mock: object): SupabaseBrowserClient {
  return mock as SupabaseBrowserClient;
}

/**
 * Supabase クエリビルダーのモッククラス。
 * - チェーンメソッド (select, insert, update, delete, eq, order) は this を返す
 * - `await chain` (thenable) は _result を解決する
 * - `.single()` は別途 mockResolvedValue で制御する
 */
export class MockQueryChain {
  _result: MockResult = { data: [], error: null };

  select = vi.fn().mockReturnThis();
  insert = vi.fn().mockReturnThis();
  update = vi.fn().mockReturnThis();
  delete = vi.fn().mockReturnThis();
  eq = vi.fn().mockReturnThis();
  or = vi.fn().mockReturnThis();
  not = vi.fn().mockReturnThis();
  lt = vi.fn().mockReturnThis();
  order = vi.fn().mockReturnThis();
  limit = vi.fn().mockReturnThis();
  single = vi.fn().mockResolvedValue({ data: null, error: null });
  maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  upsert = vi.fn().mockReturnThis();

  // Thenable interface — `await chain` でここが呼ばれる
  then<T = MockResult>(
    onfulfilled?: ((value: MockResult) => T | PromiseLike<T>) | null,
    onrejected?: ((reason: unknown) => never) | null
  ): Promise<T> {
    return Promise.resolve(this._result).then(
      onfulfilled ?? undefined,
      onrejected ?? undefined
    );
  }
}

export function createMockSupabase(chain = new MockQueryChain()) {
  return {
    from: vi.fn().mockReturnValue(chain),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
    _chain: chain,
  };
}
