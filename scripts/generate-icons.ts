import sharp from "sharp";
import { resolve } from "path";

const root = resolve(import.meta.dir, "..");
const svgPath = resolve(root, "assets/icon.svg");
const svgBuffer = Buffer.from(await Bun.file(svgPath).arrayBuffer());

const sizes = [16, 48, 128];

for (const size of sizes) {
  const outPath = resolve(root, `assets/icon-${size}.png`);
  await sharp(svgBuffer).resize(size, size).png().toFile(outPath);
  console.log(`Generated ${size}x${size} -> assets/icon-${size}.png`);
}
