import { describe, it, expect } from "vitest";
import { getAvatarEmoji, avatarUrlFromKey, AVATAR_PRESETS } from "@/lib/avatar";

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
