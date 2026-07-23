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
if (!readFileSync(workerPath, "utf8").includes("fetch(request).catch")) {
  throw new Error("Service worker tidak memiliki fallback offline.");
}
console.log("PWA manifest, icon, dan offline fallback tersedia.");
