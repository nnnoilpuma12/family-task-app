"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  HOUSEHOLD_CACHE_KEY,
  getCachedHouseholdId,
  getCachedHouseholdName,
  setCachedHousehold,
  clearCachedHousehold,
} from "@/lib/household-cache";
import { clearPersistedQueryCache } from "@/lib/query-persist";
import { createSubscribeHandler } from "@/lib/realtime";
import type { Profile, Household } from "@/types";

interface UsePageDataOptions {
  redirectIfNoHousehold?: boolean;
  fetchHousehold?: boolean;
}

interface PageData {
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;
  members: Profile[];
  household: Household | null;
  setHousehold: (h: Household | null) => void;
  householdName: string;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function usePageData(options: UsePageDataOptions = {}): PageData {
  const { redirectIfNoHousehold = true } = options;
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [household, setHouseholdState] = useState<Household | null>(null);
  const [householdName, setHouseholdName] = useState("家族タスク");
  const [loading, setLoading] = useState(true);
  const requestGeneration = useRef(0);
  const invalidateRequests = useCallback(() => {
    requestGeneration.current++;
  }, []);

  const updateHousehold = useCallback((next: Household | null) => {
    setHouseholdState(next);
    if (next?.name) {
      setHouseholdName(next.name);
      setCachedHousehold(next.id, next.name);
    }
  }, []);

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current;
    const cachedName = getCachedHouseholdName();
    if (cachedName) setHouseholdName(cachedName);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (generation !== requestGeneration.current) return;

    const user = session?.user;
    if (!user) {
      clearCachedHousehold();
      clearPersistedQueryCache();
      setProfile(null);
      setMembers([]);
      setHouseholdState(null);
      router.push("/login");
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (generation !== requestGeneration.current) return;

    if (profileError) {
      toast.error("プロフィールの取得に失敗しました");
      setLoading(false);
      return;
    }

    let nextProfile = profileData;
    if (!nextProfile) {
      const { data: created, error: createError } = await supabase
        .from("profiles")
        .upsert({ id: user.id, nickname: user.user_metadata?.nickname ?? "" })
        .select()
        .single();
      if (generation !== requestGeneration.current) return;
      if (createError || !created) {
        toast.error("プロフィールの作成に失敗しました");
        setLoading(false);
        return;
      }
      nextProfile = created;
    }

    const previousHouseholdId = getCachedHouseholdId();
    if (previousHouseholdId && previousHouseholdId !== nextProfile.household_id) {
      clearCachedHousehold();
      clearPersistedQueryCache();
    }
    setProfile(nextProfile);

    if (!nextProfile.household_id) {
      clearCachedHousehold();
      setMembers([]);
      setHouseholdState(null);
      setHouseholdName("家族タスク");
      if (redirectIfNoHousehold) router.push("/household/new");
      setLoading(false);
      return;
    }

    const householdId = nextProfile.household_id;
    const [householdResult, membersResult] = await Promise.all([
      supabase.from("households").select("*").eq("id", householdId).single(),
      supabase
        .from("profiles")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at", { ascending: true }),
    ]);
    if (generation !== requestGeneration.current) return;

    if (householdResult.error) toast.error("ハウスホールドの取得に失敗しました");
    if (membersResult.error) toast.error("メンバーの取得に失敗しました");
    if (householdResult.data) updateHousehold(householdResult.data);
    if (membersResult.data) setMembers(membersResult.data);
    setLoading(false);
  }, [redirectIfNoHousehold, router, supabase, updateHousehold]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
      invalidateRequests();
    };
  }, [invalidateRequests, load]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === HOUSEHOLD_CACHE_KEY) void load();
    };
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("online", refreshWhenVisible);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenVisible);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [load]);

  useEffect(() => {
    if (!profile?.id) return;
    let pageDataChannel = supabase
      .channel(`page-data:${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => void load()
      );
    if (profile.household_id) {
      pageDataChannel = pageDataChannel.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "households",
          filter: `id=eq.${profile.household_id}`,
        },
        () => void load()
      );
    }
    pageDataChannel.subscribe(
      createSubscribeHandler(`page-data:${profile.id}`, () => void load())
    );

    return () => {
      supabase.removeChannel(pageDataChannel);
    };
  }, [load, profile?.household_id, profile?.id, supabase]);

  return {
    profile,
    setProfile,
    members,
    household,
    setHousehold: updateHousehold,
    householdName,
    loading,
    refresh: load,
  };
}
