const configuredBase = process.env.SMOKE_BASE_URL;
if (!configuredBase) throw new Error("SMOKE_BASE_URL wajib diisi.");

const configuredUrl = new URL(configuredBase);
if (configuredUrl.protocol !== "https:") {
  throw new Error("SMOKE_BASE_URL wajib memakai HTTPS.");
}

const baseHostname = configuredUrl.hostname.toLowerCase();
const apexHostname = baseHostname.startsWith("www.") ? baseHostname.slice(4) : baseHostname;
const allowedHostnames = new Set([apexHostname, `www.${apexHostname}`]);

function assertSafeUrl(value, label) {
  const url = value instanceof URL ? value : new URL(value);

  if (url.protocol !== "https:") {
    throw new Error(`${label} keluar dari HTTPS.`);
  }
  if (!allowedHostnames.has(url.hostname.toLowerCase())) {
    throw new Error(`${label} dialihkan ke host tidak diizinkan: ${url.hostname}`);
  }
  if (url.username || url.password) {
    throw new Error(`${label} memuat credential pada URL.`);
  }

  return url;
}

function normalizedPath(pathname) {
  if (pathname === "/") return "/";
  return pathname.replace(/\/+$/, "");
}

function assertExpectedPath(finalUrl, expectedPath, label) {
  if (normalizedPath(finalUrl.pathname) !== normalizedPath(expectedPath)) {
    throw new Error(`${label} berakhir pada path tidak terduga: ${finalUrl.pathname}`);
  }
}

function assertContentType(response, acceptedTypes, label) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!acceptedTypes.some((type) => contentType.includes(type))) {
    throw new Error(`${label} memiliki Content-Type tidak sesuai: ${contentType || "kosong"}`);
  }
}

async function fetchPublic(canonicalOrigin, path, acceptedTypes) {
  const response = await fetch(new URL(path, canonicalOrigin), {
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Smoke gagal pada ${path}: ${response.status}`);
  }

  const finalUrl = assertSafeUrl(response.url, `Endpoint ${path}`);
  assertExpectedPath(finalUrl, path, `Endpoint ${path}`);
  assertContentType(response, acceptedTypes, `Endpoint ${path}`);

  return response;
}

const landing = await fetch(configuredUrl, { redirect: "follow" });
if (!landing.ok) {
  throw new Error(`Smoke gagal pada /: ${landing.status}`);
}

const canonicalUrl = assertSafeUrl(landing.url, "Landing canonical");
assertExpectedPath(canonicalUrl, "/", "Landing canonical");
assertContentType(landing, ["text/html"], "Landing canonical");

const canonicalOrigin = canonicalUrl.origin;

await fetchPublic(canonicalOrigin, "/login", ["text/html"]);
await fetchPublic(canonicalOrigin, "/manifest.webmanifest", [
  "application/manifest+json",
  "application/json",
]);
await fetchPublic(canonicalOrigin, "/offline.html", ["text/html"]);

const protectedResponse = await fetch(new URL("/dashboard", canonicalOrigin), {
  redirect: "manual",
});

if (![302, 303, 307, 308].includes(protectedResponse.status)) {
  throw new Error(`Protected route tidak mengalihkan anonymous: ${protectedResponse.status}`);
}

const location = protectedResponse.headers.get("location");
if (!location) {
  throw new Error("Protected route redirect tidak memiliki Location header.");
}

const protectedTarget = assertSafeUrl(
  new URL(location, canonicalOrigin),
  "Protected route redirect",
);
if (normalizedPath(protectedTarget.pathname) === "/dashboard") {
  throw new Error("Protected route mengalihkan kembali ke dashboard.");
}

if (!landing.headers.get("content-security-policy")?.includes("frame-ancestors 'none'")) {
  throw new Error("Security header production tidak lengkap.");
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      configuredOrigin: configuredUrl.origin,
      canonicalOrigin,
      protectedRedirect: `${protectedTarget.pathname}${protectedTarget.search}`,
      checks: [
        "landing",
        "login",
        "manifest",
        "offline",
        "anonymous-dashboard-redirect",
        "content-security-policy",
      ],
    },
    null,
    2,
  ),
);
