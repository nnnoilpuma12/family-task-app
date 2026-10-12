import { getAvatarEmoji } from "@/lib/avatar";

export const DEFAULT_NOTIFICATION_ICON = "/icon-192x192.png?v=3";

/** Resolve the authenticated sender's saved avatar; never use a request-supplied URL. */
export function getNotificationIcon(
  avatarUrl: string | null | undefined,
  senderId: string,
  storageUrl: string | undefined
): string {
  if (!avatarUrl) return DEFAULT_NOTIFICATION_ICON;
  if (getAvatarEmoji(avatarUrl)) {
    return `/notification-avatars/${avatarUrl.slice(6)}.png?v=1`;
  }

  try {
    if (!storageUrl) return DEFAULT_NOTIFICATION_ICON;
    const storage = new URL(storageUrl);
    const image = new URL(avatarUrl);
    const prefix = `/storage/v1/object/public/avatars/${senderId}/`;
    // Only our public avatar bucket and this sender's folder are valid.
    if (
      !["https:", "http:"].includes(image.protocol) ||
      image.origin !== storage.origin ||
      image.username || image.password ||
      !image.pathname.startsWith(prefix) ||
      !/^[a-zA-Z0-9-]+\.(?:webp|png|jpe?g)$/.test(image.pathname.slice(prefix.length))
    ) return DEFAULT_NOTIFICATION_ICON;
    return image.href;
  } catch {
    return DEFAULT_NOTIFICATION_ICON;
  }
}
