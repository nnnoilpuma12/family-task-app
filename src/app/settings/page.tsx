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
  const { categories, addCategory, updateCategory, deleteCategory, reorderCategories } = useCategories(
    profile?.household_id ?? null
  );

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-surface/95 backdrop-blur border-b border-border px-4 py-3">
        <button onClick={() => router.back()} className="text-muted hover:text-foreground">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-bold tracking-tight text-foreground">設定</h1>
      </header>

      <div className="mx-auto max-w-lg p-4 flex flex-col gap-6">
        {profile && (
          <div className="rounded-xl bg-surface p-4 border border-border">
            <ProfileEditor profile={profile} onUpdate={setProfile} />
          </div>
        )}

        {household && profile && (
          <div className="rounded-xl bg-surface p-4 border border-border">
            <HouseholdSettings
              household={household}
              onUpdate={setHousehold}
              members={members}
              currentUserId={profile.id}
            />
          </div>
        )}

        <div className="rounded-xl bg-surface p-4 border border-border">
          <NotificationSettings />
        </div>

        <div className="rounded-xl bg-surface p-4 border border-border">
          <CategorySettings
            categories={categories}
            onAdd={async (name, color) => { await addCategory(name, color); }}
            onUpdate={async (id, updates) => { await updateCategory(id, updates); }}
            onDelete={async (id) => { await deleteCategory(id); }}
            onReorder={async (ids) => { await reorderCategories(ids); }}
          />
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 rounded-xl bg-surface p-4 text-danger font-medium border border-border hover:bg-surface-strong"
        >
          <LogOut size={18} />
          ログアウト
        </button>
      </div>
    </div>
  );
}
