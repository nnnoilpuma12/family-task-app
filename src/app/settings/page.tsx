"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ProfileEditor } from "@/components/settings/profile-editor";
import { HouseholdSettings } from "@/components/settings/household-settings";
import { CategorySettings } from "@/components/settings/category-settings";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { useCategories } from "@/hooks/use-categories";
import { usePageData } from "@/hooks/use-page-data";

export default function SettingsPage() {
  const router = useRouter();
  const { profile, setProfile, members, household, setHousehold } = usePageData({
    redirectIfNoHousehold: false,
    fetchHousehold: true,
  });
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories(
    profile?.household_id ?? null
  );

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-white/95 border-b border-gray-100 px-4 py-3">
        <button onClick={() => router.back()} className="text-gray-600">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-gray-900">設定</h1>
      </header>

      <div className="mx-auto max-w-lg p-4 flex flex-col gap-6">
        {profile && (
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <ProfileEditor profile={profile} onUpdate={setProfile} />
          </div>
        )}

        {household && profile && (
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <HouseholdSettings
              household={household}
              onUpdate={setHousehold}
              members={members}
              currentUserId={profile.id}
            />
          </div>
        )}

        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <NotificationSettings />
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <CategorySettings
            categories={categories}
            onAdd={async (name, color) => { await addCategory(name, color); }}
            onUpdate={async (id, updates) => { await updateCategory(id, updates); }}
            onDelete={async (id) => { await deleteCategory(id); }}
          />
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 rounded-xl bg-white p-4 text-red-600 font-medium shadow-sm border border-gray-100 hover:bg-red-50"
        >
          <LogOut size={18} />
          ログアウト
        </button>
      </div>
    </div>
  );
}
