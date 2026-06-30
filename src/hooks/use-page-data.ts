"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  getCachedHouseholdName,
  setCachedHousehold,
  clearCachedHousehold,
} from "@/lib/household-cache";
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

export function usePageData(options: UsePageDataOptions = {}): PageData {
  const { redirectIfNoHousehold = true, fetchHousehold = false } = options;
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [household, setHousehold] = useState<Household | null>(null);
  const [householdName, setHouseholdName] = useState("家族タスク");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // キャッシュ済みの世帯名を即時反映してヘッダーの CLS を防ぐ
      // （マウント後の実行なのでハイドレーション不整合は起きない）
      const cachedName = getCachedHouseholdName();
      if (cachedName) setHouseholdName(cachedName);

      const supabase = createClient();
      // middleware が全リクエストでサーバ側セッション検証を済ませているため、
      // ここはネットワーク往復のない getSession() で十分（認証往復の二重化を回避）
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        clearCachedHousehold();
        router.push("/login");
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) toast.error("プロフィールの取得に失敗しました");

      let p = profileData;
      if (!p) {
        const { data: created } = await supabase
          .from("profiles")
          .upsert({ id: user.id, nickname: user.user_metadata?.nickname ?? "" })
          .select()
          .single();
        p = created;
      }

      if (!p) {
        setLoading(false);
        return;
      }

      if (!p.household_id && redirectIfNoHousehold) {
        clearCachedHousehold();
        setProfile(p);
        router.push("/household/new");
        setLoading(false);
        return;
      }

      setProfile(p);

      if (p.household_id) {
        const hid = p.household_id;
        if (fetchHousehold) {
          const [householdResult, membersResult] = await Promise.all([
            supabase
              .from("households")
              .select("*")
              .eq("id", hid)
              .single(),
            supabase
              .from("profiles")
              .select("*")
              .eq("household_id", hid)
              .order("created_at", { ascending: true }),
          ]);

          if (householdResult.error) toast.error("ハウスホールドの取得に失敗しました");
          if (householdResult.data) {
            setHousehold(householdResult.data);
            if (householdResult.data.name) {
              setHouseholdName(householdResult.data.name);
              setCachedHousehold(hid, householdResult.data.name);
            }
          }

          if (membersResult.error) toast.error("メンバーの取得に失敗しました");
          if (membersResult.data) setMembers(membersResult.data);
        } else {
          // ホーム画面: メンバー・名前をバックグラウンドで取得（画面表示をブロックしない）
          supabase
            .from("profiles")
            .select("*")
            .eq("household_id", hid)
            .then(({ data, error }) => {
              if (error) toast.error("メンバーの取得に失敗しました");
              if (data) setMembers(data);
            });

          supabase
            .from("households")
            .select("name")
            .eq("id", hid)
            .single()
            .then(({ data }) => {
              if (data?.name) {
                setHouseholdName(data.name);
                // 次回起動で profiles を待たずに名前・id を即時利用するためキャッシュ
                setCachedHousehold(hid, data.name);
              }
            });
        }
      }

      setLoading(false);
    };
    load();
  }, [router, redirectIfNoHousehold, fetchHousehold]);

  return { profile, setProfile, members, household, setHousehold, householdName, loading };
}
