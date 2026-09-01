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

/**
 * avatar_url がアップロード画像（URL）を指しているか判定する。
 *
 * avatar_url は 3 状態を取りうる：
 *   * null            … 未設定（ニックネーム頭文字を表示）
 *   * "emoji:<key>"   … プリセット絵文字
 *   * "http(s)://..." … Storage にアップロードしたカスタム画像
 *
 * 保存前のプレビューでは blob: URL も同じ経路で描画したいので許可する
 * （blob: が profiles に保存されることはない）。
 */
export function isImageAvatarUrl(avatarUrl: string | null | undefined): boolean {
  if (!avatarUrl) return false;
  return (
    avatarUrl.startsWith("https://") ||
    avatarUrl.startsWith("http://") ||
    avatarUrl.startsWith("blob:")
  );
}

/** 画像アバターの URL を返す。絵文字プリセット / 未設定なら null。 */
export function getAvatarImageUrl(avatarUrl: string | null | undefined): string | null {
  return isImageAvatarUrl(avatarUrl) && avatarUrl ? avatarUrl : null;
}

/** Storage に保存済みのカスタム画像（＝削除対象になりうる）かどうか。 */
export function isUploadedAvatarUrl(avatarUrl: string | null | undefined): boolean {
  if (!avatarUrl) return false;
  return avatarUrl.startsWith("https://") || avatarUrl.startsWith("http://");
}
