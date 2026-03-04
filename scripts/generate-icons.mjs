#!/usr/bin/env node
/**
 * Adaptive Icon PNG 生成スクリプト
 * foreground.svg + background.svg を合成して各サイズのPNGを生成
 */
import sharp from "sharp";
import { readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const adaptiveDir = join(rootDir, "public", "adaptive-icon");
const publicDir = join(rootDir, "public");

const backgroundSvg = readFileSync(join(adaptiveDir, "background.svg"));
const foregroundSvg = readFileSync(join(adaptiveDir, "foreground.svg"));

// 生成するアイコンサイズ
const sizes = [48, 72, 96, 144, 192, 512];

async function generateIcon(size) {
  // background レイヤーを指定サイズでレンダリング
  const background = await sharp(backgroundSvg)
    .resize(size, size)
    .png()
    .toBuffer();

  // foreground レイヤーを指定サイズでレンダリング
  const foreground = await sharp(foregroundSvg)
    .resize(size, size)
    .png()
    .toBuffer();

  // 合成
  const combined = await sharp(background)
    .composite([{ input: foreground, top: 0, left: 0 }])
    .png()
    .toBuffer();

  return combined;
}

async function generateMaskableIcon(size) {
  // マスカブルアイコン: 円形マスクなしの正方形（背景 + 前景）
  // Android はOSがマスクを適用するため、正方形のままでOK
  return generateIcon(size);
}

async function generateFavicon() {
  // 32x32 favicon 用
  const icon32 = await generateIcon(32);
  // ICO は作れないので PNG favicon を使用
  await sharp(icon32).toFile(join(publicDir, "favicon.png"));
  console.log("  ✓ favicon.png (32x32)");
}

async function main() {
  console.log("🎨 Adaptive Icon 生成開始...\n");

  // 通常アイコン (PWA用)
  for (const size of sizes) {
    const buf = await generateIcon(size);
    const filename = `icon-${size}x${size}.png`;
    await sharp(buf).toFile(join(publicDir, filename));
    console.log(`  ✓ ${filename}`);
  }

  // マスカブルアイコン (Adaptive Icon用)
  for (const size of [192, 512]) {
    const buf = await generateMaskableIcon(size);
    const filename = `icon-maskable-${size}x${size}.png`;
    await sharp(buf).toFile(join(publicDir, filename));
    console.log(`  ✓ ${filename} (maskable)`);
  }

  // Apple Touch Icon (180x180)
  const appleBuf = await generateIcon(180);
  await sharp(appleBuf).toFile(join(publicDir, "apple-touch-icon.png"));
  console.log("  ✓ apple-touch-icon.png (180x180)");

  // Favicon
  await generateFavicon();

  console.log("\n✅ 全アイコン生成完了！");
}

main().catch(console.error);
