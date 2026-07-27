import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import net from "node:net";

import { loadLocalSupabaseEnvironment } from "./lib/supabase-admin.mjs";

const marker = ".local/e2e-disposable";
if (
  process.env.SIPEKA_E2E_DISPOSABLE !== "true" ||
  !existsSync(marker) ||
  readFileSync(marker, "utf8").trim() !== "disposable"
) {
  throw new Error(
    "Cross-browser destructive memerlukan SIPEKA_E2E_DISPOSABLE=true dan marker .local/e2e-disposable.",
  );
}

const { API_URL } = loadLocalSupabaseEnvironment();
const supabaseOrigin = new URL(API_URL);
if (!["127.0.0.1", "localhost"].includes(supabaseOrigin.hostname)) {
  throw new Error("Cross-browser destructive hanya boleh memakai Supabase lokal.");
}

const playwrightVersion = "1.61.1";
const dockerImage = `mcr.microsoft.com/playwright:v${playwrightVersion}-noble`;
const playwrightServerPort = Number(process.env.SIPEKA_PLAYWRIGHT_SERVER_PORT ?? "3011");
const containerName = `sipeka-playwright-${process.pid}`;

const baseEnvironment = {
  ...process.env,
  DO_NOT_TRACK: "1",
  SUPABASE_TELEMETRY_DISABLED: "1",
};

const browserEnvironment = {
  ...baseEnvironment,
  PLAYWRIGHT_BASE_URL: "https://localhost:3443",
  PLAYWRIGHT_REUSE_EXISTING_SERVER: "true",
  PLAYWRIGHT_WEBSERVER_URL: "https://localhost:3443",
};

function run(command, args, environment = baseEnvironment) {
  console.log(`\n+ ${[command, ...args].join(" ")}`);
  execFileSync(command, args, {
    env: environment,
    stdio: "inherit",
  });
}

function runCapture(command, args, environment = baseEnvironment) {
  console.log(`\n+ ${[command, ...args].join(" ")}`);
  return execFileSync(command, args, {
    encoding: "utf8",
    env: environment,
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

function waitForHttp(url, child, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (child.exitCode !== null) {
        reject(new Error(`Production server berhenti sebelum siap dengan kode ${child.exitCode}.`));
        return;
      }

      const request = httpRequest(url, { method: "GET" }, (response) => {
        response.resume();
        resolve();
      });

      request.once("error", () => {
        if (Date.now() >= deadline) {
          reject(new Error(`Production server tidak siap dalam batas waktu: ${url}`));
          return;
        }
        setTimeout(attempt, 500);
      });

      request.end();
    };

    attempt();
  });
}

function waitForPort(port, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection({ host: "127.0.0.1", port });

      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });

      socket.once("error", () => {
        socket.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`Playwright Docker server tidak siap pada port ${port}.`));
          return;
        }
        setTimeout(attempt, 500);
      });
    };

    attempt();
  });
}

async function stopChild(child) {
  if (child.exitCode !== null) return;

  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);

  if (child.exitCode === null) child.kill("SIGKILL");
}

function removeDockerContainer() {
  try {
    execFileSync("docker", ["rm", "-f", containerName], {
      env: baseEnvironment,
      stdio: "ignore",
    });
  } catch {
    // Container mungkin sudah berhenti dan terhapus karena --rm.
  }
}

for (const [command, args] of [
  ["npm", ["run", "db:reset"]],
  ["node", ["tools/refresh-local-gateway.mjs"]],
  ["npm", ["run", "seed:test-users"]],
  ["npm", ["run", "probe:test-auth"]],
  ["npm", ["run", "test:auth-policy"]],
  ["node", ["tools/run-local-next-production.mjs", "build"]],
]) {
  run(command, args);
}

console.log("\n+ node tools/run-local-next-production.mjs start");
const productionServer = spawn("node", ["tools/run-local-next-production.mjs", "start"], {
  env: baseEnvironment,
  stdio: "inherit",
});

try {
  await waitForHttp("http://127.0.0.1:3000/login", productionServer);

  run(
    "npx",
    [
      "playwright",
      "test",
      "e2e/cross-browser-smoke.spec.ts",
      "--project=firefox-smoke",
      "--retries=0",
    ],
    browserEnvironment,
  );

  removeDockerContainer();

  runCapture("docker", [
    "run",
    "-d",
    "--rm",
    "--init",
    "--ipc=host",
    "--network=host",
    "--name",
    containerName,
    dockerImage,
    "/bin/sh",
    "-lc",
    `npx -y playwright@${playwrightVersion} run-server --port ${playwrightServerPort} --host 127.0.0.1`,
  ]);

  try {
    await waitForPort(playwrightServerPort);

    run(
      "npx",
      [
        "playwright",
        "test",
        "e2e/cross-browser-smoke.spec.ts",
        "--project=webkit-smoke",
        "--retries=0",
      ],
      {
        ...browserEnvironment,
        PW_TEST_CONNECT_WS_ENDPOINT: `ws://127.0.0.1:${playwrightServerPort}/`,
      },
    );
  } catch (error) {
    console.error("\nLog Playwright Docker server:");
    try {
      execFileSync("docker", ["logs", containerName], {
        env: baseEnvironment,
        stdio: "inherit",
      });
    } catch {
      // Abaikan apabila container sudah tidak tersedia.
    }
    throw error;
  } finally {
    removeDockerContainer();
  }
} finally {
  removeDockerContainer();
  await stopChild(productionServer);
}

console.log("\nCROSS_BROWSER_PRODUCTION_VALIDATION_PASSED=1");
console.log("FIREFOX_SMOKE_PASSED=1");
console.log("WEBKIT_SMOKE_PASSED=1");
console.log("PRODUCTION_DATABASE_TOUCHED=0");
console.log("LOCAL_DATABASE_RESET=1");
