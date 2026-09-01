"use client";

import { getAvatarEmoji, getAvatarImageUrl } from "@/lib/avatar";

interface AvatarProps {
  profile: { nickname: string; avatar_url: string | null };
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-2xl",
} as const;

const emojiTextSize = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
} as const;

export function Avatar({ profile, size = "md" }: AvatarProps) {
  const imageUrl = getAvatarImageUrl(profile.avatar_url);
  const emoji = getAvatarEmoji(profile.avatar_url);

  // アップロード画像は背景画像として描画する（正方形にトリミング済みなので cover で崩れない）
  if (imageUrl) {
    return (
      <div
        role="img"
        aria-label={profile.nickname}
        title={profile.nickname}
        style={{ backgroundImage: `url("${encodeURI(imageUrl)}")` }}
        className={`rounded-full bg-surface-strong bg-cover bg-center ${sizeClasses[size]}`}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-surface-strong font-bold text-foreground ${sizeClasses[size]}`}
      title={profile.nickname}
    >
      {emoji ? (
        <span className={emojiTextSize[size]}>{emoji}</span>
      ) : (
        profile.nickname.charAt(0) || "?"
      )}
    </div>
  );
}
