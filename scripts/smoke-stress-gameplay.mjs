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
const PORT = Number(process.env.SMOKE_PORT || 4174);
const SMOKE_ROUTE = process.env.SMOKE_ROUTE || "/";

const STRESS_ACTIONS = {
  steps: [
    { buttons: [], frames: 12 },
    { buttons: ["left_mouse_button"], frames: 2, mouse_x: 320, mouse_y: 420 },
    { buttons: [], frames: 20 },
    { buttons: ["up"], frames: 24 },
    { buttons: ["right"], frames: 24 },
    { buttons: ["left_mouse_button"], frames: 3, mouse_x: 620, mouse_y: 340 },
    { buttons: [], frames: 20 }
  ]
};

function normalizeRoutePrefix(route) {
  if (!route || route === "/") return "/";
  let value = String(route).trim();
  if (!value.startsWith("/")) value = "/" + value;
  if (!value.endsWith("/")) value += "/";
  return value;
}

function assertFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found at ${filePath}. Set WEB_GAME_CLIENT env var.`);
  }
}

function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: "inherit",
      ...options
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) return resolve();
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
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for dev server at ${url}`);
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function readStates(dir) {
  const files = fs.readdirSync(dir)
    .filter((name) => /^state-\d+\.json$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0));
  if (!files.length) throw new Error(`No state-*.json files found in ${dir}`);
  return files.map((name) => ({
    name,
    data: JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"))
  }));
}

function assertStressState(states) {
  const sawCombat = states.some((entry) => entry.data.mode === "combat");
  if (!sawCombat) {
    throw new Error("Stress run did not reach combat mode (menu-only regression).");
  }

  const latest = states[states.length - 1].data;
  if (!latest.player) {
    throw new Error("Stress run missing player state in render_game_to_text output.");
  }
  if (!latest.terrain) {
    throw new Error("Stress run missing terrain debug state.");
  }

  const perf = latest.perf || {};
  const perfKeys = ["frameMs", "maxFrameMsRecent", "hitchCountRecent", "terrainLastUpdateMs"];
  for (const key of perfKeys) {
    if (typeof perf[key] !== "number" || Number.isNaN(perf[key])) {
      throw new Error(`Stress run missing perf.${key} numeric field.`);
    }
  }

  if ((latest.simElapsed || 0) < 8) {
    throw new Error(`Stress run simElapsed too low (${latest.simElapsed}); actions likely did not execute.`);
  }
}

function assertNoErrorArtifacts(dir) {
  const errorFiles = fs.readdirSync(dir).filter((name) => /^errors-\d+\.json$/.test(name));
  if (errorFiles.length > 0) {
    throw new Error(`Stress run produced console/page error artifacts: ${errorFiles.join(", ")}`);
  }
}

async function main() {
  assertFileExists(WEB_GAME_CLIENT, "Playwright client");

  const routePrefix = normalizeRoutePrefix(SMOKE_ROUTE);
  const stressOut = path.join(ROOT, "output", "web-game-smoke-stress");
  cleanDir(stressOut);

  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const devServer = spawn(
    npmCmd,
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(PORT)],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }
  );

  let devStdout = "";
  let devStderr = "";
  devServer.stdout.on("data", (chunk) => { devStdout += chunk.toString(); });
  devServer.stderr.on("data", (chunk) => { devStderr += chunk.toString(); });

  const stopDevServer = () => {
    if (devServer.killed) return;
    devServer.kill("SIGTERM");
    setTimeout(() => {
      if (!devServer.killed) devServer.kill("SIGKILL");
    }, 1000).unref();
  };

  try {
    await waitForServer(`http://127.0.0.1:${PORT}${routePrefix}`);

    await runCommand("node", [
      WEB_GAME_CLIENT,
      "--url",
      `http://127.0.0.1:${PORT}${routePrefix}`,
      "--click-selector",
      "text=NEW VOYAGE",
      "--actions-json",
      JSON.stringify(STRESS_ACTIONS),
      "--iterations",
      "4",
      "--pause-ms",
      "180",
      "--screenshot-dir",
      stressOut
    ]);

    const states = readStates(stressOut);
    assertStressState(states);
    assertNoErrorArtifacts(stressOut);

    const latest = states[states.length - 1].data;
    console.log("\nStress smoke checks passed:");
    console.log(`- route=${routePrefix}, latestMode=${latest.mode}, simElapsed=${latest.simElapsed}`);
    console.log(`- perf: frameMs=${latest.perf.frameMs}, maxRecent=${latest.perf.maxFrameMsRecent}, hitches=${latest.perf.hitchCountRecent}, terrainMs=${latest.perf.terrainLastUpdateMs}`);
    console.log(`Artifacts:\n  ${stressOut}`);
  } catch (error) {
    console.error("\nStress smoke checks failed.");
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
