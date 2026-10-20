/**
 * 直近にアクセスした世帯の id / 名前を localStorage にキャッシュする軽量ヘルパ。
 *
 * householdName を即時表示してヘッダーの CLS を抑え、サーバーで確認した
 * householdId との相違を検知するために使う。データ取得のスコープには、
 * キャッシュではなく最新の profile.household_id だけを使う。
 *
 * SSR ガードと try/catch を必ず通すこと（プライベートブラウズ等で localStorage が
 * 例外を投げてもキャッシュ無し＝従来フローへフォールバックする）。
 */

export const HOUSEHOLD_CACHE_KEY = "family-task:household-cache";
export const HOUSEHOLD_CHANGED_EVENT = "family-task:household-changed";

interface HouseholdCache {
  id: string;
  name: string;
}

function read(): HouseholdCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(HOUSEHOLD_CACHE_KEY);
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
    const previousId = read()?.id ?? null;
    window.localStorage.setItem(HOUSEHOLD_CACHE_KEY, JSON.stringify({ id, name }));
    if (previousId && previousId !== id) {
      window.dispatchEvent(new CustomEvent(HOUSEHOLD_CHANGED_EVENT));
    }
  } catch {
    // localStorage 不可（プライベートブラウズ等）は無視
  }
}

export function clearCachedHousehold(): void {
  if (typeof window === "undefined") return;
  try {
    const hadHousehold = read() !== null;
    window.localStorage.removeItem(HOUSEHOLD_CACHE_KEY);
    if (hadHousehold) {
      window.dispatchEvent(new CustomEvent(HOUSEHOLD_CHANGED_EVENT));
    }
  } catch {
    // 無視
  }
}
