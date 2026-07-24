import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import sharp from "sharp";

const sourceLogo = resolve("public/assets/smansa-logo.webp");
const outputDirectory = resolve("public/assets/icons");

const BRAND = "#15458f";
const BRAND_DARK = "#0b2d63";
const ACCENT = "#f1b72f";
const SURFACE = "#f8fafc";

function backgroundSvg(size) {
  const patternSize = Math.max(28, Math.round(size / 7));
  const radius = Math.round(size * 0.35);
  const ring = Math.max(3, Math.round(size * 0.018));

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${BRAND}" />
          <stop offset="1" stop-color="${BRAND_DARK}" />
        </linearGradient>
        <pattern id="kawung" width="${patternSize}" height="${patternSize}" patternUnits="userSpaceOnUse">
          <circle cx="${patternSize / 2}" cy="0" r="${patternSize * 0.28}" fill="none" stroke="${ACCENT}" stroke-width="${Math.max(1, size / 300)}" />
          <circle cx="${patternSize / 2}" cy="${patternSize}" r="${patternSize * 0.28}" fill="none" stroke="${ACCENT}" stroke-width="${Math.max(1, size / 300)}" />
          <circle cx="0" cy="${patternSize / 2}" r="${patternSize * 0.28}" fill="none" stroke="${ACCENT}" stroke-width="${Math.max(1, size / 300)}" />
          <circle cx="${patternSize}" cy="${patternSize / 2}" r="${patternSize * 0.28}" fill="none" stroke="${ACCENT}" stroke-width="${Math.max(1, size / 300)}" />
        </pattern>
      </defs>

      <rect width="${size}" height="${size}" rx="${Math.round(size * 0.19)}" fill="url(#background)" />
      <rect width="${size}" height="${size}" rx="${Math.round(size * 0.19)}" fill="url(#kawung)" opacity="0.12" />
      <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="${SURFACE}" />
      <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="${ACCENT}" stroke-width="${ring}" />
    </svg>
  `);
}

async function createIcon({ filename, size, logoScale }) {
  const logoSize = Math.round(size * logoScale);
  const logo = await sharp(sourceLogo)
    .resize({
      width: logoSize,
      height: logoSize,
      fit: "contain",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  const output = resolve(outputDirectory, filename);
  await mkdir(dirname(output), { recursive: true });

  await sharp(backgroundSvg(size))
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(output);

  console.log(`Generated ${output}`);
}

await Promise.all([
  createIcon({ filename: "sipeka-192.png", size: 192, logoScale: 0.58 }),
  createIcon({ filename: "sipeka-512.png", size: 512, logoScale: 0.58 }),
  createIcon({ filename: "sipeka-maskable-192.png", size: 192, logoScale: 0.48 }),
  createIcon({ filename: "sipeka-maskable-512.png", size: 512, logoScale: 0.48 }),
  createIcon({ filename: "apple-touch-icon.png", size: 180, logoScale: 0.58 }),
]);

await sharp(sourceLogo)
  .resize({ width: 32, height: 32, fit: "contain" })
  .png({ compressionLevel: 9 })
  .toFile(resolve(outputDirectory, "favicon-32.png"));

console.log("Brand assets SIPEKA selesai dibuat.");
