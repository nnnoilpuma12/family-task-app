export const AVATAR_PRESETS = [
  { key: "cat", emoji: "🐱", label: "ねこ" },
  { key: "dog", emoji: "🐶", label: "いぬ" },
  { key: "rabbit", emoji: "🐰", label: "うさぎ" },
  { key: "bear", emoji: "🐻", label: "くま" },
  { key: "panda", emoji: "🐼", label: "パンダ" },
  { key: "fox", emoji: "🦊", label: "きつね" },
  { key: "penguin", emoji: "🐧", label: "ペンギン" },
  { key: "koala", emoji: "🐨", label: "コアラ" },
  { key: "sunflower", emoji: "🌻", label: "ひまわり" },
  { key: "cherry_blossom", emoji: "🌸", label: "さくら" },
  { key: "rainbow", emoji: "🌈", label: "にじ" },
  { key: "star", emoji: "⭐", label: "ほし" },
  { key: "onigiri", emoji: "🍙", label: "おにぎり" },
  { key: "dango", emoji: "🍡", label: "だんご" },
  { key: "cookie", emoji: "🍪", label: "クッキー" },
  { key: "strawberry", emoji: "🍓", label: "いちご" },
  { key: "smile", emoji: "😊", label: "にこにこ" },
  { key: "angel", emoji: "😇", label: "てんし" },
  { key: "sparkles", emoji: "✨", label: "キラキラ" },
  { key: "heart", emoji: "💖", label: "ハート" },
  { key: "hamster", emoji: "🐹", label: "ハムスター" },
  { key: "chick", emoji: "🐥", label: "ひよこ" },
  { key: "dolphin", emoji: "🐬", label: "イルカ" },
  { key: "butterfly", emoji: "🦋", label: "ちょうちょ" },
] as const;

const emojiByKey = new Map<string, string>(AVATAR_PRESETS.map((p) => [p.key, p.emoji]));

export function getAvatarEmoji(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  if (!avatarUrl.startsWith("emoji:")) return null;
  const key = avatarUrl.slice(6);
  return emojiByKey.get(key) ?? null;
}

export function avatarUrlFromKey(key: string): string {
  return `emoji:${key}`;
}
