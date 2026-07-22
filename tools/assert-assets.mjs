import { access, stat } from "node:fs/promises";

const assets = ["public/assets/smansa-logo.webp", "public/assets/smansa-hero.webp"];
for (const asset of assets) {
  await access(asset);
  const details = await stat(asset);
  if (!details.isFile() || details.size < 100) throw new Error(`Asset tidak valid: ${asset}`);
}
console.log(`Asset UI tersedia: ${assets.length}`);
