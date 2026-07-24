import { existsSync, readFileSync } from "node:fs";

const manifestPath = "public/manifest.webmanifest";
const workerPath = "public/sw.js";

if (!existsSync(manifestPath) || !existsSync(workerPath)) {
  throw new Error("Manifest atau service worker PWA tidak tersedia.");
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (manifest.display !== "standalone") {
  throw new Error("Manifest PWA harus memakai display standalone.");
}

const iconRequirements = [
  ["192x192", "any"],
  ["512x512", "any"],
  ["192x192", "maskable"],
  ["512x512", "maskable"],
];

for (const [sizes, purpose] of iconRequirements) {
  const matchingIcon = manifest.icons?.find(
    (icon) =>
      icon.sizes === sizes &&
      icon.purpose === purpose &&
      icon.type === "image/png" &&
      icon.src.startsWith("/assets/icons/"),
  );

  if (!matchingIcon) {
    throw new Error(`Ikon PWA ${sizes} (${purpose}) tidak tersedia.`);
  }
}

const worker = readFileSync(workerPath, "utf8");

if (!worker.includes("fetch(request).catch")) {
  throw new Error("Service worker tidak memiliki fallback offline.");
}

if (!worker.includes(".keys()") || !worker.includes('key.startsWith("sipeka-")')) {
  throw new Error("Service worker tidak membersihkan cache SIPEKA lama.");
}

const staticMatch = worker.match(/const STATIC = (\[[\s\S]*?\]);/);
const staticRoutes = staticMatch ? JSON.parse(staticMatch[1]) : [];

for (const icon of manifest.icons) {
  if (!staticRoutes.includes(icon.src)) {
    throw new Error(`Ikon manifest belum masuk cache statis: ${icon.src}`);
  }
}

if (
  staticRoutes.some((route) =>
    /login|change-password|dashboard|siswa|account|audit|report|api/.test(route),
  )
) {
  throw new Error("Route protected tidak boleh berada dalam cache statis.");
}

if (!worker.includes('if (request.mode === "navigate")') || worker.includes("backgroundSync")) {
  throw new Error("Navigasi harus network-first tanpa background sync.");
}

console.log("PWA manifest, icon any/maskable, dan offline fallback tersedia.");
