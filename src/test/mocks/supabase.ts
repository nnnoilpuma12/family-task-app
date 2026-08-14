import { vi } from "vitest";

export type MockResult = { data: unknown; error: unknown };

/**
 * Supabase クエリビルダーのモッククラス。
 * - チェーンメソッド (select, insert, update, delete, eq, in, order など) は this を返す
 * - `await chain` (thenable) は _result を解決する
 * - `.single()` / `.maybeSingle()` は別途 mockResolvedValue で制御する
 */
export class MockQueryChain {
  _result: MockResult = { data: [], error: null };

  select = vi.fn().mockReturnThis();
  insert = vi.fn().mockReturnThis();
  update = vi.fn().mockReturnThis();
  upsert = vi.fn().mockReturnThis();
  delete = vi.fn().mockReturnThis();
  eq = vi.fn().mockReturnThis();
  neq = vi.fn().mockReturnThis();
  in = vi.fn().mockReturnThis();
  or = vi.fn().mockReturnThis();
  not = vi.fn().mockReturnThis();
  filter = vi.fn().mockReturnThis();
  lt = vi.fn().mockReturnThis();
  lte = vi.fn().mockReturnThis();
  gt = vi.fn().mockReturnThis();
  gte = vi.fn().mockReturnThis();
  order = vi.fn().mockReturnThis();
  limit = vi.fn().mockReturnThis();
  range = vi.fn().mockReturnThis();
  single = vi.fn().mockResolvedValue({ data: null, error: null });
  maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

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

/** テーブルごとの指定。チェーンを直接渡すか、返却値だけを渡す。 */
export type TableSpec = MockQueryChain | Partial<MockResult>;

function toChain(spec: TableSpec): MockQueryChain {
  if (spec instanceof MockQueryChain) return spec;
  const chain = new MockQueryChain();
  chain._result = { data: spec.data ?? [], error: spec.error ?? null };
  return chain;
}

/**
 * Supabase クライアントのモックを生成する。
 *
 * テーブルごとに返却値を分ける（推奨）:
 *   const client = createMockSupabase({
 *     profiles: { data: [profile] },
 *     staple_items: { data: items },
 *   });
 *   client._table("staple_items")._result = { data: [], error: null };  // 後から差し替え
 *
 * 単一チェーンを全テーブルで共有する（既存テスト互換）:
 *   const chain = new MockQueryChain();
 *   const client = createMockSupabase(chain);
 */
export function createMockSupabase(
  spec: MockQueryChain | Record<string, TableSpec> = new MockQueryChain()
) {
  // 単一チェーンを渡された場合は全テーブルで共有する（旧シグネチャ互換）
  const sharedChain = spec instanceof MockQueryChain ? spec : null;
  const chains: Record<string, MockQueryChain> = {};

  if (!sharedChain) {
    for (const [table, tableSpec] of Object.entries(spec)) {
      chains[table] = toChain(tableSpec);
    }
  }

  // 未指定のテーブルは空配列を返すチェーンを遅延生成する
  const table = (name: string): MockQueryChain => {
    if (sharedChain) return sharedChain;
    if (!chains[name]) chains[name] = new MockQueryChain();
    return chains[name];
  };

  return {
    from: vi.fn((name: string) => table(name)),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" } } },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
    /** テーブル名からチェーンを取得する（未指定なら生成） */
    _table: table,
    /** 共有チェーン。テーブル別指定のときは null */
    _chain: sharedChain,
  };
}
