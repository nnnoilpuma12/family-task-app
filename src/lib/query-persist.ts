import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

/**
 * React Query キャッシュの localStorage 永続化まわりの設定を1か所に集約する。
 * Providers（永続化の有効化）と、ログアウト/世帯切替時の破棄処理から共有する。
 */

/** 永続キャッシュを保存する localStorage キー */
export const PERSIST_KEY = "family-task:rq-cache";

/**
 * キャッシュ形式のバージョン（persistOptions.buster に渡す）。
 * DB スキーマや型を変更してキャッシュ互換が崩れるときは、この値を上げて旧キャッシュを無効化する。
 */
export const APP_CACHE_VERSION = "v1";

/**
 * 永続化用の SyncStoragePersister を生成する。
 * SSR 時は storage を undefined にし、ライブラリ側で no-op として扱わせる。
 */
export function createAppPersister() {
  return createSyncStoragePersister({
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    key: PERSIST_KEY,
  });
}

/**
 * 永続キャッシュを localStorage から削除する。
 * 別ユーザー/別世帯に切り替わる境界（ログアウト・世帯参加）で呼び、端末に家事内容を残さない。
 */
export function clearPersistedQueryCache(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PERSIST_KEY);
  } catch {
    // localStorage 不可（プライベートブラウズ等）は無視
  }
}
