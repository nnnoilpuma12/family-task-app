import { createClient } from "@/lib/supabase/client";

/** カスタムアイコンを置く Storage バケット（019_avatar_storage.sql） */
export const AVATAR_BUCKET = "avatars";

/** 受け付ける入力ファイルの MIME。デコードはブラウザ任せなので広めに許可する */
export const ACCEPTED_AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

/** input[type=file] の accept 属性値 */
export const AVATAR_FILE_ACCEPT = ACCEPTED_AVATAR_MIME_TYPES.join(",");

/** 入力ファイルサイズの上限（変換前）。これを超えるとデコードでメモリを食うため弾く */
export const MAX_AVATAR_INPUT_BYTES = 8 * 1024 * 1024;

/** 編集プレビュー用に一度縮小する長辺サイズ。巨大な写真をそのまま扱わないため */
const PREVIEW_MAX_EDGE = 1440;

/** アップロードする正方形アイコンの一辺（px）。Retina の 64pt 表示まで耐える */
export const AVATAR_OUTPUT_SIZE = 256;

/** トリミング UI のズーム範囲 */
export const AVATAR_ZOOM_MIN = 1;
export const AVATAR_ZOOM_MAX = 3;

export interface AvatarSource {
  /** プレビュー用に正規化（EXIF 適用・縮小）した画像 */
  blob: Blob;
  /** blob の object URL。呼び出し側が revokeObjectURL する */
  url: string;
  width: number;
  height: number;
}

export interface AvatarCropRect {
  sx: number;
  sy: number;
  size: number;
}

/**
 * 選択されたファイルを検証する。問題なければ null、あれば日本語のエラーメッセージを返す。
 */
export function validateAvatarFile(file: File): string | null {
  const type = file.type.toLowerCase();
  const isAccepted = (ACCEPTED_AVATAR_MIME_TYPES as readonly string[]).includes(type);
  // 一部の環境（Android の一部ブラウザ等）で type が空になることがあるため
  // 空文字は拒否せずデコード側の失敗に委ねる
  if (type !== "" && !isAccepted) {
    return "画像ファイル（JPEG / PNG / WebP / GIF）を選んでください";
  }
  if (file.size > MAX_AVATAR_INPUT_BYTES) {
    return "画像サイズが大きすぎます（8MB まで）";
  }
  if (file.size === 0) {
    return "画像を読み込めませんでした";
  }
  return null;
}

/**
 * ズーム倍率に対する表示サイズと、パン可能なオフセットの上限を求める。
 *
 * viewportSize の正方形を画像が必ず覆う（＝余白が出ない）ことを前提とし、
 * zoom = 1 で短辺がちょうどビューポートに収まる。
 */
export function getAvatarDisplayMetrics(
  imageWidth: number,
  imageHeight: number,
  viewportSize: number,
  zoom: number
): { displayWidth: number; displayHeight: number; maxOffsetX: number; maxOffsetY: number } {
  const scale = (viewportSize / Math.min(imageWidth, imageHeight)) * zoom;
  const displayWidth = imageWidth * scale;
  const displayHeight = imageHeight * scale;
  return {
    displayWidth,
    displayHeight,
    maxOffsetX: Math.max(0, (displayWidth - viewportSize) / 2),
    maxOffsetY: Math.max(0, (displayHeight - viewportSize) / 2),
  };
}

/** パン位置を「画像がビューポートを覆う」範囲に収める */
export function clampAvatarOffset(
  offset: { x: number; y: number },
  imageWidth: number,
  imageHeight: number,
  viewportSize: number,
  zoom: number
): { x: number; y: number } {
  const { maxOffsetX, maxOffsetY } = getAvatarDisplayMetrics(
    imageWidth,
    imageHeight,
    viewportSize,
    zoom
  );
  return {
    x: Math.min(maxOffsetX, Math.max(-maxOffsetX, offset.x)),
    y: Math.min(maxOffsetY, Math.max(-maxOffsetY, offset.y)),
  };
}

/**
 * トリミング UI の状態（ズーム + パン）から、元画像上の切り出し矩形を求める。
 * 表示（CSS transform）と切り出し（canvas drawImage）で同じ式を使うことで
 * プレビューと保存結果を一致させる。
 */
export function computeAvatarCropRect(
  imageWidth: number,
  imageHeight: number,
  viewportSize: number,
  zoom: number,
  offset: { x: number; y: number }
): AvatarCropRect {
  const clamped = clampAvatarOffset(offset, imageWidth, imageHeight, viewportSize, zoom);
  const { displayWidth, displayHeight } = getAvatarDisplayMetrics(
    imageWidth,
    imageHeight,
    viewportSize,
    zoom
  );
  const scale = displayWidth / imageWidth;

  // ビューポート座標での画像左上端
  const left = viewportSize / 2 - displayWidth / 2 + clamped.x;
  const top = viewportSize / 2 - displayHeight / 2 + clamped.y;

  const size = viewportSize / scale;
  const sx = Math.min(Math.max(0, -left / scale), Math.max(0, imageWidth - size));
  const sy = Math.min(Math.max(0, -top / scale), Math.max(0, imageHeight - size));

  return { sx, sy, size };
}

/** File / Blob をデコードする。EXIF の向きは画像側の指定に従わせる */
async function decodeImage(source: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    return await createImageBitmap(source, { imageOrientation: "from-image" });
  }
  const url = URL.createObjectURL(source);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("画像のデコードに失敗しました"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("画像の変換に失敗しました"));
      },
      // WebP 非対応環境では PNG が返る。その場合は下で JPEG に切り替える
      "image/webp",
      quality
    );
  });
}

async function encodeCanvas(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const blob = await toBlob(canvas, quality);
  if (blob.type === "image/webp") return blob;

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (jpeg) => {
        if (jpeg) resolve(jpeg);
        else reject(new Error("画像の変換に失敗しました"));
      },
      "image/jpeg",
      quality
    );
  });
}

function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("画像の変換に失敗しました");
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}

/**
 * 選択ファイルを編集用に正規化する（EXIF 適用済み・長辺 PREVIEW_MAX_EDGE 以下）。
 * 以降のプレビューとトリミングはこの結果だけを見るので、
 * 巨大な元画像をメモリに保持し続けずに済む。
 */
export async function createAvatarSource(file: File): Promise<AvatarSource> {
  const decoded = await decodeImage(file);
  const longestEdge = Math.max(decoded.width, decoded.height);
  const ratio = longestEdge > PREVIEW_MAX_EDGE ? PREVIEW_MAX_EDGE / longestEdge : 1;
  const width = Math.round(decoded.width * ratio);
  const height = Math.round(decoded.height * ratio);

  const { canvas, ctx } = createCanvas(width, height);
  ctx.drawImage(decoded, 0, 0, width, height);
  if (decoded instanceof ImageBitmap) decoded.close();

  const blob = await encodeCanvas(canvas, 0.92);
  return { blob, url: URL.createObjectURL(blob), width, height };
}

/** 正規化済み画像を切り出して、アップロードするアイコン画像を生成する */
export async function renderAvatarBlob(source: AvatarSource, crop: AvatarCropRect): Promise<Blob> {
  const decoded = await decodeImage(source.blob);
  const { canvas, ctx } = createCanvas(AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
  ctx.drawImage(
    decoded,
    crop.sx,
    crop.sy,
    crop.size,
    crop.size,
    0,
    0,
    AVATAR_OUTPUT_SIZE,
    AVATAR_OUTPUT_SIZE
  );
  if (decoded instanceof ImageBitmap) decoded.close();
  return await encodeCanvas(canvas, 0.85);
}

/** 公開 URL から Storage 上のパス（<uid>/<uuid>.webp）を取り出す。対象外なら null */
export function getAvatarStoragePath(publicUrl: string | null | undefined): string | null {
  if (!publicUrl) return null;
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  const path = publicUrl.slice(index + marker.length).split("?")[0];
  return path ? decodeURIComponent(path) : null;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  return "webp";
}

/**
 * アイコン画像をアップロードして公開 URL を返す。
 * パスの先頭を uid にすることで storage.objects の RLS を通す。
 */
export async function uploadAvatarImage(userId: string, blob: Blob): Promise<string> {
  const supabase = createClient();
  const path = `${userId}/${crypto.randomUUID()}.${extensionForMimeType(blob.type)}`;

  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * 差し替え・リセットで不要になった画像を削除する（best-effort）。
 * 失敗してもプロフィール更新自体は成功しているので、呼び出し側には投げない。
 */
export async function deleteAvatarImage(publicUrl: string | null | undefined): Promise<void> {
  const path = getAvatarStoragePath(publicUrl);
  if (!path) return;
  const supabase = createClient();
  await supabase.storage.from(AVATAR_BUCKET).remove([path]);
}
