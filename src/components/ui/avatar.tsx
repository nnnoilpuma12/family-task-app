"use client";

import { getAvatarEmoji } from "@/lib/avatar";

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
  const emoji = getAvatarEmoji(profile.avatar_url);

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700 ${sizeClasses[size]}`}
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
