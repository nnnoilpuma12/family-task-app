// @vitest-environment node
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import manifest from "../../public/manifest.json";

const publicDir = resolve(process.cwd(), "public");

describe("PWA installation icons", () => {
  it.each([192, 512])("provides separate any and maskable %ipx icons", async (size) => {
    const icons = manifest.icons.filter((icon) => icon.sizes === `${size}x${size}`);
    const fallback = icons.find((icon) => icon.purpose === "any");
    const maskable = icons.find((icon) => icon.purpose === "maskable");
    if (!fallback || !maskable) throw new Error(`Missing installation icon for ${size}px`);
    const maskablePath = maskable.src.split("?")[0];
    expect(maskablePath).not.toBe(fallback.src.split("?")[0]);

    const icon = sharp(resolve(publicDir, `.${maskablePath}`));
    const { format, width, height } = await icon.metadata();
    expect({ format, width, height }).toEqual({ format: "png", width: size, height: size });

    const pixels = await icon.ensureAlpha().raw().toBuffer();
    const background = await sharp(resolve(publicDir, "adaptive-icon/background.svg"))
      .resize(size, size)
      .ensureAlpha()
      .raw()
      .toBuffer();
    let minimumAlpha = 255;
    let artworkRadius = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      minimumAlpha = Math.min(minimumAlpha, pixels[offset + 3]);
      if (pixels.readUInt32BE(offset) === background.readUInt32BE(offset)) continue;

      const pixel = offset / 4;
      const x = pixel % size + 0.5 - size / 2;
      const y = Math.floor(pixel / size) + 0.5 - size / 2;
      artworkRadius = Math.max(artworkRadius, Math.hypot(x, y));
    }
    expect(minimumAlpha).toBe(255);
    expect(artworkRadius).toBeGreaterThan(0);
    expect(artworkRadius).toBeLessThanOrEqual(0.4 * size);
  });
});
