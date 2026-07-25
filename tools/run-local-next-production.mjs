import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { resolve } from "node:path";

import { loadLocalSupabaseEnvironment } from "./lib/supabase-admin.mjs";

const mode = process.argv[2];
if (!["build", "start"].includes(mode)) {
  throw new Error("Mode wajib build atau start.");
}

const nextCli = resolve("node_modules/next/dist/bin/next");
if (!existsSync(nextCli)) {
  throw new Error(`Next CLI lokal tidak ditemukan: ${nextCli}`);
}

const localDirectory = resolve(".local");
const nextPort = Number(process.env.SIPEKA_NEXT_PORT ?? "3000");
const httpsPort = Number(process.env.SIPEKA_HTTPS_PORT ?? "3443");
const certificatePath = resolve(
  process.env.SIPEKA_HTTPS_CERT ?? ".local/sipeka-localhost-cert.pem",
);
const privateKeyPath = resolve(process.env.SIPEKA_HTTPS_KEY ?? ".local/sipeka-localhost-key.pem");
const opensslConfigPath = resolve(".local/sipeka-localhost-openssl.cnf");

const local = loadLocalSupabaseEnvironment();
const childEnvironment = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.ANON_KEY ?? local.PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
  RATE_LIMIT_SECRET:
    process.env.RATE_LIMIT_SECRET ?? "sipeka-local-production-e2e-rate-limit-secret",
  SUPABASE_SERVICE_ROLE_KEY: local.SECRET_KEY ?? local.SERVICE_ROLE_KEY,
};

function runNext(args) {
  const child = spawn(process.execPath, [nextCli, ...args], {
    env: childEnvironment,
    stdio: "inherit",
  });

  child.once("error", (error) => {
    console.error(`Gagal menjalankan Next CLI lokal: ${error.message}`);
    process.exit(1);
  });

  return child;
}

function certificateIsUsable() {
  if (!existsSync(certificatePath) || !existsSync(privateKeyPath)) {
    return false;
  }

  const check = spawnSync(
    "openssl",
    ["x509", "-in", certificatePath, "-noout", "-checkend", "60"],
    { stdio: "ignore" },
  );

  return check.status === 0;
}

function ensureCertificate() {
  mkdirSync(localDirectory, { recursive: true });

  if (certificateIsUsable()) return;

  writeFileSync(
    opensslConfigPath,
    `[req]
distinguished_name = distinguished_name
prompt = no
x509_extensions = v3_req

[distinguished_name]
CN = localhost

[v3_req]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
`,
  );

  const generated = spawnSync(
    "openssl",
    [
      "req",
      "-x509",
      "-nodes",
      "-newkey",
      "rsa:2048",
      "-sha256",
      "-days",
      "2",
      "-keyout",
      privateKeyPath,
      "-out",
      certificatePath,
      "-config",
      opensslConfigPath,
      "-extensions",
      "v3_req",
    ],
    { stdio: "ignore" },
  );

  if (generated.status !== 0 || !certificateIsUsable()) {
    throw new Error("Gagal membuat sertifikat HTTPS localhost.");
  }
}

if (mode === "build") {
  const build = runNext(["build"]);

  build.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
} else {
  ensureCertificate();

  const nextServer = runNext(["start", "--hostname", "127.0.0.1", "--port", String(nextPort)]);

  const proxy = createHttpsServer(
    {
      cert: readFileSync(certificatePath),
      key: readFileSync(privateKeyPath),
    },
    (request, response) => {
      const forwardedHost = request.headers.host ?? `localhost:${httpsPort}`;

      const upstream = httpRequest(
        {
          headers: {
            ...request.headers,
            host: forwardedHost,
            "x-forwarded-host": forwardedHost,
            "x-forwarded-port": String(httpsPort),
            "x-forwarded-proto": "https",
          },
          hostname: "127.0.0.1",
          method: request.method,
          path: request.url,
          port: nextPort,
        },
        (upstreamResponse) => {
          const statusCode = upstreamResponse.statusCode ?? 502;

          if (upstreamResponse.statusMessage) {
            response.writeHead(
              statusCode,
              upstreamResponse.statusMessage,
              upstreamResponse.headers,
            );
          } else {
            response.writeHead(statusCode, upstreamResponse.headers);
          }

          upstreamResponse.pipe(response);
        },
      );

      upstream.once("error", (error) => {
        if (!response.headersSent) {
          response.writeHead(502, {
            "content-type": "text/plain; charset=utf-8",
          });
        }

        response.end(`Next upstream belum siap: ${error.message}`);
      });

      request.pipe(upstream);
    },
  );

  proxy.on("clientError", (_error, socket) => {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  });

  let stopping = false;

  function stop(signal) {
    if (stopping) return;
    stopping = true;

    proxy.close();
    nextServer.kill(signal);

    setTimeout(() => process.exit(1), 5_000).unref();
  }

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => stop(signal));
  }

  nextServer.on("exit", (code, signal) => {
    proxy.close(() => {
      if (signal && !stopping) {
        process.kill(process.pid, signal);
        return;
      }

      process.exit(code ?? (stopping ? 0 : 1));
    });
  });

  proxy.listen(httpsPort, "127.0.0.1", () => {
    console.log(
      `HTTPS lokal siap: https://localhost:${httpsPort} -> ` + `http://127.0.0.1:${nextPort}`,
    );
  });
}
