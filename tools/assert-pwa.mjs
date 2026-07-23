import { existsSync, readFileSync } from "node:fs";

const manifestPath = "public/manifest.webmanifest";
const workerPath = "public/sw.js";
if (!existsSync(manifestPath) || !existsSync(workerPath)) {
  throw new Error("Manifest atau service worker PWA tidak tersedia.");
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (manifest.display !== "standalone" || !manifest.icons?.length) {
  throw new Error("Manifest PWA tidak installable.");
}
const worker = readFileSync(workerPath, "utf8");
if (!worker.includes("fetch(request).catch")) {
  throw new Error("Service worker tidak memiliki fallback offline.");
}
if (!worker.includes(".keys()") || !worker.includes('key.startsWith("sipeka-")')) {
  throw new Error("Service worker tidak membersihkan cache SIPEKA lama.");
}
const staticMatch = worker.match(/const STATIC = (\[[^;]+\])/);
const staticRoutes = staticMatch ? JSON.parse(staticMatch[1]) : [];
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
console.log("PWA manifest, icon, dan offline fallback tersedia.");
