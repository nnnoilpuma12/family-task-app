import { describe, it, expect } from "vitest";
import {
  getAvatarEmoji,
  avatarUrlFromKey,
  AVATAR_PRESETS,
  isImageAvatarUrl,
  getAvatarImageUrl,
  isUploadedAvatarUrl,
} from "@/lib/avatar";

describe("getAvatarEmoji", () => {
  it("既知のキーは対応する絵文字を返す", () => {
    expect(getAvatarEmoji("emoji:cat")).toBe("🐱");
  });

  it("全プリセットキーが絵文字に解決できる", () => {
    for (const preset of AVATAR_PRESETS) {
      expect(getAvatarEmoji(`emoji:${preset.key}`)).toBe(preset.emoji);
    }
  });

  it("存在しないキーは null を返す", () => {
    expect(getAvatarEmoji("emoji:unknown_key_xyz")).toBeNull();
  });

  it("null 入力は null を返す", () => {
    expect(getAvatarEmoji(null)).toBeNull();
  });

  it("undefined 入力は null を返す", () => {
    expect(getAvatarEmoji(undefined)).toBeNull();
  });

  it("emoji: プレフィックスなしは null を返す", () => {
    expect(getAvatarEmoji("cat")).toBeNull();
  });

  it("https:// URL は null を返す（カスタムアバター URL）", () => {
    expect(getAvatarEmoji("https://example.com/avatar.png")).toBeNull();
  });
});

describe("avatarUrlFromKey", () => {
  it("key から emoji: プレフィックス付き URL を生成する", () => {
    expect(avatarUrlFromKey("cat")).toBe("emoji:cat");
  });

  it("getAvatarEmoji と往復できる", () => {
    const key = "dog";
    const url = avatarUrlFromKey(key);
    expect(getAvatarEmoji(url)).toBe("🐶");
  });
});

describe("isImageAvatarUrl / getAvatarImageUrl / isUploadedAvatarUrl", () => {
  it("https URL は画像アバターとして扱う", () => {
    const url = "https://xyz.supabase.co/storage/v1/object/public/avatars/u/a.webp";
    expect(isImageAvatarUrl(url)).toBe(true);
    expect(getAvatarImageUrl(url)).toBe(url);
    expect(isUploadedAvatarUrl(url)).toBe(true);
  });

  it("blob URL はプレビュー用に画像として扱うが、アップロード済みではない", () => {
    expect(isImageAvatarUrl("blob:http://localhost/abc")).toBe(true);
    expect(isUploadedAvatarUrl("blob:http://localhost/abc")).toBe(false);
  });

  it("絵文字プリセット・null は画像ではない", () => {
    expect(isImageAvatarUrl("emoji:cat")).toBe(false);
    expect(getAvatarImageUrl("emoji:cat")).toBeNull();
    expect(isImageAvatarUrl(null)).toBe(false);
    expect(getAvatarImageUrl(undefined)).toBeNull();
    expect(isUploadedAvatarUrl(null)).toBe(false);
  });
});
