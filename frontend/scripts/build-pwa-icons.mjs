/**
 * Xuất favicon.svg (icon play CineViet) sang PNG 192x192 và 512x512 cho PWA.
 * Chạy: node scripts/build-pwa-icons.mjs (từ thư mục frontend)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const svgPath = path.join(publicDir, 'favicon.svg');
const svg = fs.readFileSync(svgPath);

async function build() {
  for (const size of [192, 512]) {
    const outPath = path.join(publicDir, `icon-${size}.png`);
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`Created ${outPath}`);
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
