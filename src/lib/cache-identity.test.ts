import { beforeEach, describe, expect, it } from "vitest";
import { syncCacheOwner } from "@/lib/cache-identity";
import { getCachedHouseholdId, setCachedHousehold } from "@/lib/household-cache";
import { PERSIST_KEY } from "@/lib/query-persist";

describe("cache ownership", () => {
  beforeEach(() => window.localStorage.clear());

  it("clears legacy unowned data before assigning an owner", () => {
    setCachedHousehold("previous-household", "以前の世帯");
    window.localStorage.setItem(PERSIST_KEY, "old tasks");

    expect(syncCacheOwner("user-1")).toBe(false);
    expect(getCachedHouseholdId()).toBeNull();
    expect(window.localStorage.getItem(PERSIST_KEY)).toBeNull();
  });

  it("keeps data for the same user and clears it when the account changes", () => {
    syncCacheOwner("user-1");
    setCachedHousehold("household-1", "わが家");
    window.localStorage.setItem(PERSIST_KEY, "user-1 tasks");

    expect(syncCacheOwner("user-1")).toBe(true);
    expect(getCachedHouseholdId()).toBe("household-1");

    expect(syncCacheOwner("user-2")).toBe(false);
    expect(getCachedHouseholdId()).toBeNull();
    expect(window.localStorage.getItem(PERSIST_KEY)).toBeNull();
  });

  it("clears data when the session disappears", () => {
    syncCacheOwner("user-1");
    setCachedHousehold("household-1", "わが家");
    window.localStorage.setItem(PERSIST_KEY, "private tasks");

    expect(syncCacheOwner(null)).toBe(false);
    expect(getCachedHouseholdId()).toBeNull();
    expect(window.localStorage.getItem(PERSIST_KEY)).toBeNull();
  });
});
