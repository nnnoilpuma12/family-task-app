import { vi } from "vitest";

/**
 * Supabase クエリビルダーのモッククラス。
 * - チェーンメソッド (select, insert, update, delete, eq, order) は this を返す
 * - `await chain` (thenable) は _result を解決する
 * - `.single()` は別途 mockResolvedValue で制御する
 */
export class MockQueryChain {
  _result: { data: any; error: any } = { data: [], error: null };

  select = vi.fn().mockReturnThis();
  insert = vi.fn().mockReturnThis();
  update = vi.fn().mockReturnThis();
  delete = vi.fn().mockReturnThis();
  eq = vi.fn().mockReturnThis();
  order = vi.fn().mockReturnThis();
  single = vi.fn().mockResolvedValue({ data: null, error: null });

  // Thenable interface — `await chain` でここが呼ばれる
  then<T = any>(
    onfulfilled?: ((value: { data: any; error: any }) => T | PromiseLike<T>) | null,
    onrejected?: ((reason: any) => never) | null
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
