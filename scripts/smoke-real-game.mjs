import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const WEB_GAME_CLIENT = process.env.WEB_GAME_CLIENT || path.join(CODEX_HOME, "skills", "develop-web-game", "scripts", "web_game_playwright_client.js");
const WEB_GAME_ACTIONS = process.env.WEB_GAME_ACTIONS || path.join(CODEX_HOME, "skills", "develop-web-game", "references", "action_payloads.json");
const PORT = Number(process.env.SMOKE_PORT || 4173);
const SMOKE_ROUTE = process.env.SMOKE_ROUTE || "/game/";

function normalizeRoutePrefix(route) {
  if (!route || route === "/") return "/";
  var value = String(route).trim();
  if (!value.startsWith("/")) value = "/" + value;
  if (!value.endsWith("/")) value += "/";
  return value;
}

function withQuery(basePath, query) {
  if (!query) return basePath;
  return basePath + query;
}

function assertFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found at ${filePath}. Set ${label === "Playwright client" ? "WEB_GAME_CLIENT" : "WEB_GAME_ACTIONS"} env var.`);
  }
}

function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed: ${cmd} ${args.join(" ")} (code=${code}, signal=${signal || "none"})`));
    });
  });
}

async function waitForServer(url, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // keep polling until timeout
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for dev server at ${url}`);
}

function readLatestState(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Smoke output dir missing: ${dir}`);
  }

  const stateFiles = fs
    .readdirSync(dir)
    .filter((name) => /^state-\d+\.json$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0));

  if (stateFiles.length === 0) {
    throw new Error(`No state-*.json files found in ${dir}`);
  }

  const filePath = path.join(dir, stateFiles[stateFiles.length - 1]);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertDefaultRouteState(state) {
  if (state.mode !== "menu") {
    throw new Error(`Default route expected mode=menu, got mode=${state.mode}`);
  }

  const backend = state.renderer?.backend;
  if (!backend || backend === "unknown") {
    throw new Error("Default route did not expose a valid renderer backend in render_game_to_text");
  }
}

function assertBootstrapRouteState(state) {
  if (state.mode === "unsupported") {
    return {
      status: "unsupported",
      detail: "WebGPU unsupported on this machine/browser; fallback route is active",
    };
  }

  if (state.mode !== "running") {
    throw new Error(`Bootstrap route expected mode=running, got mode=${state.mode}`);
  }

  if (state.renderer !== "webgpu") {
    throw new Error(`Bootstrap route expected renderer=webgpu, got renderer=${state.renderer}`);
  }

  return { status: "ok", detail: "WebGPU bootstrap active" };
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  assertFileExists(WEB_GAME_CLIENT, "Playwright client");
  assertFileExists(WEB_GAME_ACTIONS, "Action payload");

  const routePrefix = normalizeRoutePrefix(SMOKE_ROUTE);
  const defaultRoutePath = routePrefix;
  const bootstrapRoutePath = withQuery(routePrefix, "?bootstrap=1");

  const defaultOut = path.join(ROOT, "output", "web-game-smoke-default");
  const bootstrapOut = path.join(ROOT, "output", "web-game-smoke-bootstrap");
  cleanDir(defaultOut);
  cleanDir(bootstrapOut);

  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const devServer = spawn(
    npmCmd,
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(PORT)],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }
  );

  let devStdout = "";
  let devStderr = "";
  devServer.stdout.on("data", (chunk) => {
    devStdout += chunk.toString();
  });
  devServer.stderr.on("data", (chunk) => {
    devStderr += chunk.toString();
  });

  const stopDevServer = () => {
    if (devServer.killed) return;
    devServer.kill("SIGTERM");
    setTimeout(() => {
      if (!devServer.killed) devServer.kill("SIGKILL");
    }, 1000).unref();
  };

  try {
    await waitForServer(`http://127.0.0.1:${PORT}${defaultRoutePath}`);

    await runCommand("node", [
      WEB_GAME_CLIENT,
      "--url",
      `http://127.0.0.1:${PORT}${defaultRoutePath}`,
      "--actions-file",
      WEB_GAME_ACTIONS,
      "--iterations",
      "2",
      "--pause-ms",
      "250",
      "--screenshot-dir",
      defaultOut,
    ]);

    await runCommand("node", [
      WEB_GAME_CLIENT,
      "--url",
      `http://127.0.0.1:${PORT}${bootstrapRoutePath}`,
      "--actions-file",
      WEB_GAME_ACTIONS,
      "--iterations",
      "2",
      "--pause-ms",
      "250",
      "--screenshot-dir",
      bootstrapOut,
    ]);

    const defaultState = readLatestState(defaultOut);
    const bootstrapState = readLatestState(bootstrapOut);

    assertDefaultRouteState(defaultState);
    const bootstrapResult = assertBootstrapRouteState(bootstrapState);

    console.log("\nSmoke checks passed:");
    console.log(`- ${defaultRoutePath} -> mode=${defaultState.mode}, backend=${defaultState.renderer?.backend}`);
    console.log(`- ${bootstrapRoutePath} -> ${bootstrapResult.detail}`);
    console.log(`Artifacts:\n  ${defaultOut}\n  ${bootstrapOut}`);
  } catch (error) {
    console.error("\nSmoke checks failed.");
    if (devStdout.trim()) {
      console.error("\n--- Vite stdout ---");
      console.error(devStdout.trim());
    }
    if (devStderr.trim()) {
      console.error("\n--- Vite stderr ---");
      console.error(devStderr.trim());
    }
    throw error;
  } finally {
    stopDevServer();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
