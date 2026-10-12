// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AVATAR_PRESETS } from "@/lib/avatar";
import { DEFAULT_NOTIFICATION_ICON, getNotificationIcon } from "@/lib/notification-icon";

const STORAGE = "https://project.supabase.co";
const IMAGE = `${STORAGE}/storage/v1/object/public/avatars/sender/photo.webp`;

describe("getNotificationIcon", () => {
  it("uses the sender's uploaded image, including the new URL after an update", () => {
    expect(getNotificationIcon(IMAGE, "sender", STORAGE)).toBe(IMAGE);
    const updated = IMAGE.replace("photo.webp", "new-photo.png");
    expect(getNotificationIcon(updated, "sender", STORAGE)).toBe(updated);
  });

  it.each(AVATAR_PRESETS)("has a 192px PNG for the $key preset", ({ key }) => {
    expect(getNotificationIcon(`emoji:${key}`, "sender", STORAGE))
      .toBe(`/notification-avatars/${key}.png?v=1`);
    const png = readFileSync(`${process.cwd()}/public/notification-avatars/${key}.png`);
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.readUInt32BE(16)).toBe(192);
    expect(png.readUInt32BE(20)).toBe(192);
  });

  it.each([
    null, undefined, "", "emoji:unknown", "emoji:../cat", "not-a-url",
    "javascript:alert(1)", "data:image/png;base64,AAA", "blob:https://project.supabase.co/id",
    IMAGE.replace("/sender/", "/recipient/"),
    IMAGE.replace("project.supabase.co", "external.example"),
    IMAGE.replace("/avatars/", "/other-bucket/"),
    IMAGE.replace("photo.webp", "../recipient/photo.webp"),
    IMAGE.replace("photo.webp", "nested/photo.webp"),
    IMAGE.replace("photo.webp", "photo.svg"),
    IMAGE.replace("https://", "https://user:secret@"),
  ])("falls back for an unset or invalid avatar: %s", (avatar) => {
    expect(getNotificationIcon(avatar, "sender", STORAGE)).toBe(DEFAULT_NOTIFICATION_ICON);
  });

  it("falls back when storage is not configured", () => {
    expect(getNotificationIcon(IMAGE, "sender", undefined)).toBe(DEFAULT_NOTIFICATION_ICON);
    expect(getNotificationIcon(IMAGE, "sender", "invalid")).toBe(DEFAULT_NOTIFICATION_ICON);
  });
});
