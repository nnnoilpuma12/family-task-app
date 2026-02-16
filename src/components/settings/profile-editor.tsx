"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/types";

interface ProfileEditorProps {
  profile: Profile;
  onUpdate: (profile: Profile) => void;
}

export function ProfileEditor({ profile, onUpdate }: ProfileEditorProps) {
  const [nickname, setNickname] = useState(profile.nickname);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ nickname })
      .eq("id", profile.id)
      .select()
      .single();

    if (!error && data) {
      onUpdate(data);
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-900">プロフィール</h3>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nickname" className="text-xs text-gray-500">
          ニックネーム
        </label>
        <input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
        />
      </div>
      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving ? "保存中..." : "保存"}
      </Button>
    </div>
  );
}
