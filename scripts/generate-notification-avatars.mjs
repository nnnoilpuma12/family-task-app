// Run manually with Chromium installed; generated PNGs are committed so builds
// do not depend on browser binaries or the build machine's emoji fonts.
import { chromium } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/avatar.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const { AVATAR_PRESETS } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const output = new URL("../public/notification-avatars/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const preset of AVATAR_PRESETS) {
    const data = await page.evaluate((emoji) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 192;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.fillStyle = "#f3f4f6";
      ctx.beginPath();
      ctx.arc(96, 96, 96, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '128px "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji", sans-serif';
      ctx.textAlign = "center";
      const metrics = ctx.measureText(emoji);
      const baseline = 96 + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
      ctx.fillText(emoji, 96, baseline);
      return canvas.toDataURL("image/png").split(",")[1];
    }, preset.emoji);
    await writeFile(new URL(`${preset.key}.png`, output), Buffer.from(data, "base64"));
  }
} finally {
  await browser.close();
}
