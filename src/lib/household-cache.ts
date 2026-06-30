/**
 * 直近にアクセスした世帯の id / 名前を localStorage にキャッシュする軽量ヘルパ。
 *
 * 目的：起動時に householdId を即座に得て、profiles 取得を待たずに
 * tasks / categories / staple / Realtime を並列発火させる（直列往復を1回削減）。
 * householdName も即時表示してヘッダーの CLS を解消する。
 *
 * SSR ガードと try/catch を必ず通すこと（プライベートブラウズ等で localStorage が
 * 例外を投げてもキャッシュ無し＝従来フローへフォールバックする）。
 */

const STORAGE_KEY = "family-task:household-cache";

interface HouseholdCache {
  id: string;
  name: string;
}

function read(): HouseholdCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "id" in parsed &&
      "name" in parsed &&
      typeof (parsed as Record<string, unknown>).id === "string" &&
      typeof (parsed as Record<string, unknown>).name === "string"
    ) {
      return parsed as HouseholdCache;
    }
    return null;
  } catch {
    return null;
  }
}

export function getCachedHouseholdId(): string | null {
  return read()?.id ?? null;
}

export function getCachedHouseholdName(): string | null {
  return read()?.name ?? null;
}

export function setCachedHousehold(id: string, name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, name }));
  } catch {
    // localStorage 不可（プライベートブラウズ等）は無視
  }
}

export function clearCachedHousehold(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 無視
  }
}
