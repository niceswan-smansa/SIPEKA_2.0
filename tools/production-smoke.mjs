const base = process.env.SMOKE_BASE_URL;
if (!base) throw new Error("SMOKE_BASE_URL wajib diisi.");

for (const path of ["/", "/login", "/manifest.webmanifest", "/offline.html"]) {
  const response = await fetch(new URL(path, base), { redirect: "manual" });
  if (!response.ok) throw new Error(`Smoke gagal pada ${path}: ${response.status}`);
}
const protectedResponse = await fetch(new URL("/dashboard", base), { redirect: "manual" });
if (![302, 303, 307, 308].includes(protectedResponse.status)) {
  throw new Error("Protected route tidak mengalihkan anonymous.");
}
const landing = await fetch(new URL("/", base));
if (!landing.headers.get("content-security-policy")?.includes("frame-ancestors 'none'")) {
  throw new Error("Security header production tidak lengkap.");
}
console.log("Smoke non-destruktif landing, auth guard, manifest, offline, dan headers lulus.");
