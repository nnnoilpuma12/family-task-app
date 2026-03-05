"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
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
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
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
        setProfile(p);
        router.push("/household/new");
        setLoading(false);
        return;
      }

      setProfile(p);

      if (p.household_id) {
        if (fetchHousehold) {
          const [householdResult, membersResult] = await Promise.all([
            supabase
              .from("households")
              .select("*")
              .eq("id", p.household_id)
              .single(),
            supabase
              .from("profiles")
              .select("*")
              .eq("household_id", p.household_id)
              .order("created_at", { ascending: true }),
          ]);

          if (householdResult.error) toast.error("ハウスホールドの取得に失敗しました");
          if (householdResult.data) {
            setHousehold(householdResult.data);
            if (householdResult.data.name) setHouseholdName(householdResult.data.name);
          }

          if (membersResult.error) toast.error("メンバーの取得に失敗しました");
          if (membersResult.data) setMembers(membersResult.data);
        } else {
          // ホーム画面: メンバー・名前をバックグラウンドで取得（画面表示をブロックしない）
          supabase
            .from("profiles")
            .select("*")
            .eq("household_id", p.household_id)
            .then(({ data, error }) => {
              if (error) toast.error("メンバーの取得に失敗しました");
              if (data) setMembers(data);
            });

          supabase
            .from("households")
            .select("name")
            .eq("id", p.household_id)
            .single()
            .then(({ data }) => {
              if (data?.name) setHouseholdName(data.name);
            });
        }
      }

      setLoading(false);
    };
    load();
  }, [router, redirectIfNoHousehold, fetchHousehold]);

  return { profile, setProfile, members, household, setHousehold, householdName, loading };
}
