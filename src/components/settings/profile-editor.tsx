"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { avatarUrlFromKey, isUploadedAvatarUrl } from "@/lib/avatar";
import {
  deleteAvatarImage,
  describeAvatarUploadError,
  uploadAvatarImage,
} from "@/lib/avatar-upload";
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
  // 保存済みの avatar_url（プリセット or アップロード済み画像の URL）
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  // 未アップロードのトリミング済み画像。保存ボタンで初めて Storage に送る
  const [pendingImage, setPendingImage] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const previewAvatarUrl = pendingImage?.previewUrl ?? avatarUrl;

  // アンマウント時に未保存プレビューの object URL を解放する
  const pendingPreviewRef = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (pendingPreviewRef.current) URL.revokeObjectURL(pendingPreviewRef.current);
    };
  }, []);

  const replacePendingImage = (next: { blob: Blob; previewUrl: string } | null) => {
    if (pendingPreviewRef.current) URL.revokeObjectURL(pendingPreviewRef.current);
    pendingPreviewRef.current = next?.previewUrl ?? null;
    setPendingImage(next);
  };

  const handleSelectPreset = (key: string | null) => {
    replacePendingImage(null);
    setAvatarUrl(key ? avatarUrlFromKey(key) : null);
  };

  const handleSelectImage = (blob: Blob) => {
    replacePendingImage({ blob, previewUrl: URL.createObjectURL(blob) });
  };

  const handleSave = async () => {
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) return;
    setSaving(true);

    let nextAvatarUrl = avatarUrl;
    if (pendingImage) {
      try {
        nextAvatarUrl = await uploadAvatarImage(profile.id, pendingImage.blob);
      } catch (error) {
        toast.error(describeAvatarUploadError(error));
        setSaving(false);
        return;
      }
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ nickname: trimmedNickname, avatar_url: nextAvatarUrl })
      .eq("id", profile.id)
      .select()
      .single();

    if (error) toast.error("プロフィールの保存に失敗しました");
    if (!error && data) {
      replacePendingImage(null);
      setAvatarUrl(nextAvatarUrl);
      // 差し替え・リセットで参照されなくなった旧画像は Storage から消す（best-effort）
      if (isUploadedAvatarUrl(profile.avatar_url) && profile.avatar_url !== nextAvatarUrl) {
        void deleteAvatarImage(profile.avatar_url);
      }
      onUpdate(data);
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">プロフィール</h3>

      <div className="flex justify-center">
        <button
          onClick={() => setPickerOpen(true)}
          className="relative group"
          aria-label="アイコンを変更"
        >
          <Avatar
            profile={{ nickname, avatar_url: previewAvatarUrl }}
            size="lg"
          />
          <div className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white group-hover:bg-primary-dark transition-colors">
            <Pencil size={12} />
          </div>
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nickname" className="text-xs text-muted">
          ニックネーム
        </label>
        <input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={30}
          className="rounded border border-border-strong bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-focus focus:ring-2 focus:ring-focus/15"
        />
      </div>
      <Button size="sm" onClick={handleSave} disabled={saving || !nickname.trim()}>
        {saving ? "保存中..." : "保存"}
      </Button>

      <AvatarPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedKey={getKeyFromAvatarUrl(pendingImage ? null : avatarUrl)}
        onSelectPreset={handleSelectPreset}
        onSelectImage={handleSelectImage}
      />
    </div>
  );
}
