import { access, stat } from "node:fs/promises";

const assets = [
  "public/assets/smansa-logo.webp",
  "public/assets/smansa-hero.webp",
  "public/assets/icons/favicon-32.png",
  "public/assets/icons/apple-touch-icon.png",
  "public/assets/icons/sipeka-192.png",
  "public/assets/icons/sipeka-512.png",
  "public/assets/icons/sipeka-maskable-192.png",
  "public/assets/icons/sipeka-maskable-512.png",
];

for (const asset of assets) {
  await access(asset);
  const details = await stat(asset);
  if (!details.isFile() || details.size < 100) {
    throw new Error(`Asset tidak valid: ${asset}`);
  }
}

console.log(`Asset UI tersedia: ${assets.length}`);
