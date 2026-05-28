"use client";

import { useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query-keys";
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
}

type ProfileResult = { noSession: boolean; profile: Profile | null };
type HouseholdResult = { household: Household | null; members: Profile[] };

export function usePageData(options: UsePageDataOptions = {}): PageData {
  const { redirectIfNoHousehold = true, fetchHousehold = false } = options;
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: async (): Promise<ProfileResult> => {
      // middleware が全リクエストでサーバ側セッション検証を済ませているため、
      // ここはネットワーク往復のない getSession() で十分（認証往復の二重化を回避）
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return { noSession: true, profile: null };

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;

      let p = profileData;
      if (!p) {
        const { data: created } = await supabase
          .from("profiles")
          .upsert({ id: user.id, nickname: user.user_metadata?.nickname ?? "" })
          .select()
          .single();
        p = created;
      }
      return { noSession: false, profile: p ?? null };
    },
  });

  useEffect(() => {
    if (profileQuery.isError) toast.error("プロフィールの取得に失敗しました");
  }, [profileQuery.isError]);

  const profile = profileQuery.data?.profile ?? null;
  const householdId = profile?.household_id ?? null;

  // 認証・世帯未設定のリダイレクトは取得ロジックから分離してエフェクトで実行する
  useEffect(() => {
    const res = profileQuery.data;
    if (!res) return;
    if (res.noSession) {
      router.push("/login");
      return;
    }
    if (res.profile && !res.profile.household_id && redirectIfNoHousehold) {
      router.push("/household/new");
    }
  }, [profileQuery.data, redirectIfNoHousehold, router]);

  const householdQuery = useQuery({
    queryKey: queryKeys.household(householdId),
    enabled: !!householdId,
    queryFn: async (): Promise<HouseholdResult> => {
      if (!householdId) return { household: null, members: [] };
      const [householdResult, membersResult] = await Promise.all([
        supabase.from("households").select("*").eq("id", householdId).single(),
        supabase
          .from("profiles")
          .select("*")
          .eq("household_id", householdId)
          .order("created_at", { ascending: true }),
      ]);
      if (householdResult.error) throw householdResult.error;
      return {
        household: householdResult.data ?? null,
        members: membersResult.error ? [] : membersResult.data ?? [],
      };
    },
  });

  useEffect(() => {
    if (householdQuery.isError) toast.error("ハウスホールドの取得に失敗しました");
  }, [householdQuery.isError]);

  const household = householdQuery.data?.household ?? null;
  const members = useMemo(() => householdQuery.data?.members ?? [], [householdQuery.data]);
  const householdName = household?.name || "家族タスク";

  // ホーム画面（fetchHousehold=false）は世帯情報の取得を待たずに描画する
  const loading =
    profileQuery.isLoading ||
    (fetchHousehold && !!householdId && householdQuery.isLoading);

  const setProfile = useCallback(
    (p: Profile | null) => {
      queryClient.setQueryData<ProfileResult>(queryKeys.profile(), (old) => ({
        noSession: old?.noSession ?? false,
        profile: p,
      }));
    },
    [queryClient]
  );

  const setHousehold = useCallback(
    (h: Household | null) => {
      queryClient.setQueryData<HouseholdResult>(queryKeys.household(householdId), (old) => ({
        household: h,
        members: old?.members ?? [],
      }));
    },
    [queryClient, householdId]
  );

  return { profile, setProfile, members, household, setHousehold, householdName, loading };
}
