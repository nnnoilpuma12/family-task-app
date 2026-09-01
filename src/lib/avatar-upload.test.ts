import { describe, it, expect } from "vitest";
import {
  clampAvatarOffset,
  computeAvatarCropRect,
  getAvatarDisplayMetrics,
  getAvatarStoragePath,
  validateAvatarFile,
  MAX_AVATAR_INPUT_BYTES,
} from "@/lib/avatar-upload";

function createFile(type: string, size: number): File {
  const file = new File(["x"], "avatar", { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("validateAvatarFile", () => {
  it("対応形式・サイズ内なら null", () => {
    expect(validateAvatarFile(createFile("image/jpeg", 1024))).toBeNull();
  });

  it("MIME が空でもデコードに委ねて通す", () => {
    expect(validateAvatarFile(createFile("", 1024))).toBeNull();
  });

  it("画像以外は拒否する", () => {
    expect(validateAvatarFile(createFile("application/pdf", 1024))).toContain("画像ファイル");
  });

  it("上限を超えるサイズは拒否する", () => {
    expect(validateAvatarFile(createFile("image/png", MAX_AVATAR_INPUT_BYTES + 1))).toContain(
      "大きすぎます"
    );
  });

  it("空ファイルは拒否する", () => {
    expect(validateAvatarFile(createFile("image/png", 0))).toContain("読み込めませんでした");
  });
});

describe("getAvatarDisplayMetrics", () => {
  it("zoom=1 では短辺がビューポートにちょうど収まる", () => {
    const m = getAvatarDisplayMetrics(400, 200, 100, 1);
    expect(m.displayHeight).toBe(100);
    expect(m.displayWidth).toBe(200);
  });

  it("覆いきれている方向にだけパンの余地がある", () => {
    const m = getAvatarDisplayMetrics(400, 200, 100, 1);
    expect(m.maxOffsetX).toBe(50);
    expect(m.maxOffsetY).toBe(0);
  });

  it("ズームすると両方向にパンできる", () => {
    const m = getAvatarDisplayMetrics(200, 200, 100, 2);
    expect(m.maxOffsetX).toBe(50);
    expect(m.maxOffsetY).toBe(50);
  });
});

describe("clampAvatarOffset", () => {
  it("範囲外のパンは端で止まる", () => {
    const clamped = clampAvatarOffset({ x: 999, y: -999 }, 400, 200, 100, 1);
    expect(clamped.x).toBe(50);
    // 覆う余地が無い方向は動かない（符号付きゼロを避けて比較する）
    expect(clamped.y).toBeCloseTo(0);
  });

  it("範囲内のパンはそのまま", () => {
    expect(clampAvatarOffset({ x: 10, y: 0 }, 400, 200, 100, 1)).toEqual({ x: 10, y: 0 });
  });
});

describe("computeAvatarCropRect", () => {
  it("正方形画像・等倍では画像全体を切り出す", () => {
    expect(computeAvatarCropRect(200, 200, 100, 1, { x: 0, y: 0 })).toEqual({
      sx: 0,
      sy: 0,
      size: 200,
    });
  });

  it("横長画像・等倍では中央の正方形を切り出す", () => {
    expect(computeAvatarCropRect(400, 200, 100, 1, { x: 0, y: 0 })).toEqual({
      sx: 100,
      sy: 0,
      size: 200,
    });
  });

  it("パンすると切り出し位置がずれる", () => {
    // 表示上 50px 右へ動かす → 表示倍率 0.5 なので元画像では 100px 左へ
    expect(computeAvatarCropRect(400, 200, 100, 1, { x: 50, y: 0 })).toEqual({
      sx: 0,
      sy: 0,
      size: 200,
    });
  });

  it("ズームすると切り出し範囲が狭くなる", () => {
    expect(computeAvatarCropRect(200, 200, 100, 2, { x: 0, y: 0 })).toEqual({
      sx: 50,
      sy: 50,
      size: 100,
    });
  });

  it("切り出し矩形は常に画像内に収まる", () => {
    const crop = computeAvatarCropRect(400, 200, 100, 1, { x: 9999, y: 9999 });
    expect(crop.sx).toBeGreaterThanOrEqual(0);
    expect(crop.sx + crop.size).toBeLessThanOrEqual(400);
    expect(crop.sy).toBeGreaterThanOrEqual(0);
    expect(crop.sy + crop.size).toBeLessThanOrEqual(200);
  });
});

describe("getAvatarStoragePath", () => {
  it("公開 URL からバケット内のパスを取り出す", () => {
    expect(
      getAvatarStoragePath(
        "https://xyz.supabase.co/storage/v1/object/public/avatars/user-1/abc.webp"
      )
    ).toBe("user-1/abc.webp");
  });

  it("クエリ文字列は除去する", () => {
    expect(
      getAvatarStoragePath(
        "https://xyz.supabase.co/storage/v1/object/public/avatars/user-1/abc.webp?t=123"
      )
    ).toBe("user-1/abc.webp");
  });

  it("絵文字プリセットは対象外", () => {
    expect(getAvatarStoragePath("emoji:cat")).toBeNull();
  });

  it("別バケットの URL は対象外", () => {
    expect(
      getAvatarStoragePath("https://xyz.supabase.co/storage/v1/object/public/task-images/a.png")
    ).toBeNull();
  });

  it("null / 空文字は null", () => {
    expect(getAvatarStoragePath(null)).toBeNull();
    expect(getAvatarStoragePath("")).toBeNull();
  });
});
