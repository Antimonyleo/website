// Shared "spin up the production preview, run checks, always tear it down"
// lifecycle, factored out of scripts/verify-preview.mjs so
// scripts/check-a11y.mjs and scripts/check-performance.mjs don't each
// reimplement server startup/shutdown.

import { spawn } from "node:child_process";

const readinessTimeoutMs = 20_000;
const shutdownTimeoutMs = 4_000;
const pollIntervalMs = 150;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function childExit(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve({ code: child.exitCode, signal: child.signalCode });
      return;
    }
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

/**
 * @param {object} params
 * @param {string} [params.host]
 * @param {number} params.port
 * @param {string} params.basePath - e.g. "/website/"
 */
export function createPreviewServer({ host = "127.0.0.1", port, basePath }) {
  const origin = `http://${host}:${port}`;
  let child;
  let output = "";

  function appendOutput(chunk) {
    output += chunk.toString();
    if (output.length > 24_000) output = output.slice(-24_000);
  }

  async function request(path, timeoutMs = 5_000) {
    return fetch(`${origin}${path}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  async function assertPortIsFree() {
    try {
      await request(basePath, 400);
    } catch {
      return;
    }
    throw new Error(
      `Dedicated preview port ${port} is already serving HTTP. Stop that process and retry.`,
    );
  }

  async function waitUntilReady() {
    const deadline = Date.now() + readinessTimeoutMs;
    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(
          `Preview exited before readiness (code ${child.exitCode}, signal ${child.signalCode}).`,
        );
      }
      try {
        const response = await request(basePath);
        if (response.status === 200) return;
      } catch {
        // The listener is not ready yet.
      }
      await delay(pollIntervalMs);
    }
    throw new Error(`Preview did not become ready within ${readinessTimeoutMs} ms.`);
  }

  async function start() {
    await assertPortIsFree();
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    child = spawn(
      npmCommand,
      ["run", "preview", "--", "--host", host, "--port", String(port), "--strictPort"],
      {
        cwd: process.cwd(),
        detached: process.platform !== "win32",
        env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.stdout.on("data", appendOutput);
    child.stderr.on("data", appendOutput);
    await waitUntilReady();
  }

  async function stop() {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exit = childExit(child);
    try {
      if (process.platform === "win32") {
        child.kill("SIGTERM");
      } else {
        process.kill(-child.pid, "SIGTERM");
      }
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
    const stopped = await Promise.race([
      exit.then(() => true),
      delay(shutdownTimeoutMs).then(() => false),
    ]);
    if (stopped) return;
    try {
      if (process.platform === "win32") {
        child.kill("SIGKILL");
      } else {
        process.kill(-child.pid, "SIGKILL");
      }
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
    await exit;
  }

  return {
    origin,
    start,
    stop,
    request,
    getOutput: () => output,
  };
}
