import { clearCachedHousehold } from "@/lib/household-cache";
import { clearPersistedQueryCache } from "@/lib/query-persist";

const CACHE_OWNER_KEY = "family-task:cache-owner";

/** Only restore local data when it belongs to the authenticated user. */
export function syncCacheOwner(userId: string | null): boolean {
  if (typeof window === "undefined") return false;
  try {
    const previousOwner = window.localStorage.getItem(CACHE_OWNER_KEY);
    if (!userId || previousOwner !== userId) {
      clearCachedHousehold();
      clearPersistedQueryCache();
    }
    if (userId) window.localStorage.setItem(CACHE_OWNER_KEY, userId);
    else window.localStorage.removeItem(CACHE_OWNER_KEY);
    return !!userId && previousOwner === userId;
  } catch {
    // Storage is unavailable. Callers must treat the cache as untrusted.
    clearCachedHousehold();
    clearPersistedQueryCache();
    return false;
  }
}
