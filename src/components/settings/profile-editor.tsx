"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { avatarUrlFromKey } from "@/lib/avatar";
import { Avatar } from "@/components/ui/avatar";
import { AvatarPicker } from "@/components/settings/avatar-picker";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/types";

interface ProfileEditorProps {
  profile: Profile;
  onUpdate: (profile: Profile) => void;
}

function getKeyFromAvatarUrl(avatarUrl: string | null): string | null {
  if (!avatarUrl || !avatarUrl.startsWith("emoji:")) return null;
  return avatarUrl.slice(6);
}

export function ProfileEditor({ profile, onUpdate }: ProfileEditorProps) {
  const [nickname, setNickname] = useState(profile.nickname);
  const [avatarKey, setAvatarKey] = useState<string | null>(getKeyFromAvatarUrl(profile.avatar_url));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const previewAvatarUrl = avatarKey ? avatarUrlFromKey(avatarKey) : null;

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ nickname, avatar_url: previewAvatarUrl })
      .eq("id", profile.id)
      .select()
      .single();

    if (error) toast.error("プロフィールの保存に失敗しました");
    if (!error && data) {
      onUpdate(data);
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-900">プロフィール</h3>

      <div className="flex justify-center">
        <button
          onClick={() => setPickerOpen(true)}
          className="relative group"
        >
          <Avatar
            profile={{ nickname, avatar_url: previewAvatarUrl }}
            size="lg"
          />
          <div className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm group-hover:bg-indigo-700 transition-colors">
            <Pencil size={12} />
          </div>
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nickname" className="text-xs text-gray-500">
          ニックネーム
        </label>
        <input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={30}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
        />
      </div>
      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving ? "保存中..." : "保存"}
      </Button>

      <AvatarPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedKey={avatarKey}
        onSelect={setAvatarKey}
      />
    </div>
  );
}
