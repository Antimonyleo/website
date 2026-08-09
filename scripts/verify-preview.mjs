import { spawn } from "node:child_process";

const host = "127.0.0.1";
const port = 4379;
const origin = `http://${host}:${port}`;
const basePath = "/website/";
const readinessTimeoutMs = 20_000;
const shutdownTimeoutMs = 4_000;
const pollIntervalMs = 150;

const routes = [
  { path: basePath, status: 200, marker: "<main" },
  { path: `${basePath}research/`, status: 200, marker: "<main" },
  { path: `${basePath}news/`, status: 200, marker: "data-news-post" },
  {
    path: `${basePath}publications/`,
    status: 200,
    marker: "data-publication-record",
  },
  { path: `${basePath}experience/`, status: 200, marker: "<main" },
  { path: `${basePath}contact/`, status: 200, marker: "data-email-domain" },
  {
    path: `${basePath}preview-verification-not-found/`,
    status: 404,
    marker: 'content="noindex, nofollow"',
  },
];

let preview;
let output = "";

function appendOutput(chunk) {
  output += chunk.toString();
  if (output.length > 24_000) {
    output = output.slice(-24_000);
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
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

async function request(path, timeoutMs = 2_000) {
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
    if (preview.exitCode !== null || preview.signalCode !== null) {
      throw new Error(
        `Preview exited before readiness (code ${preview.exitCode}, signal ${preview.signalCode}).`,
      );
    }
    try {
      const response = await request(basePath);
      if (response.status === 200) {
        return;
      }
    } catch {
      // The listener is not ready yet.
    }
    await delay(pollIntervalMs);
  }
  throw new Error(`Preview did not become ready within ${readinessTimeoutMs} ms.`);
}

async function verifyRoutes() {
  for (const route of routes) {
    const response = await request(route.path, 5_000);
    const body = await response.text();
    if (response.status !== route.status) {
      throw new Error(
        `${route.path} returned ${response.status}; expected ${route.status}.`,
      );
    }
    if (!body.includes(route.marker)) {
      throw new Error(`${route.path} is missing readiness marker ${route.marker}.`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      throw new Error(`${route.path} did not return text/html.`);
    }
  }

  const favicon = await request(`${basePath}favicon.svg`, 5_000);
  if (favicon.status !== 200) {
    throw new Error(
      `${basePath}favicon.svg returned ${favicon.status}; expected 200.`,
    );
  }

  const bibliography = await request(
    `${basePath}publications/hao-liu-publications.bib`,
    5_000,
  );
  const bibliographyBody = await bibliography.text();
  if (bibliography.status !== 200) {
    throw new Error(
      `${basePath}publications/hao-liu-publications.bib returned ${bibliography.status}; expected 200.`,
    );
  }
  if (!bibliographyBody.includes("@article{pyrochlore_2024,")) {
    throw new Error("BibTeX download is missing the verified pyrochlore record.");
  }
}

async function stopPreview() {
  if (!preview || preview.exitCode !== null || preview.signalCode !== null) {
    return;
  }

  const exit = childExit(preview);
  try {
    if (process.platform === "win32") {
      preview.kill("SIGTERM");
    } else {
      process.kill(-preview.pid, "SIGTERM");
    }
  } catch (error) {
    if (error.code !== "ESRCH") {
      throw error;
    }
  }

  const stopped = await Promise.race([
    exit.then(() => true),
    delay(shutdownTimeoutMs).then(() => false),
  ]);
  if (stopped) {
    return;
  }

  try {
    if (process.platform === "win32") {
      preview.kill("SIGKILL");
    } else {
      process.kill(-preview.pid, "SIGKILL");
    }
  } catch (error) {
    if (error.code !== "ESRCH") {
      throw error;
    }
  }
  await exit;
}

async function run() {
  await assertPortIsFree();
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  preview = spawn(
    npmCommand,
    [
      "run",
      "preview",
      "--",
      "--host",
      host,
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd: process.cwd(),
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        ASTRO_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  preview.stdout.on("data", appendOutput);
  preview.stderr.on("data", appendOutput);

  try {
    await waitUntilReady();
    await verifyRoutes();
    console.log(
      `Production preview passed: dedicated ${origin}${basePath} served ${routes.length} routes, a base-path asset, and the BibTeX download.`,
    );
  } finally {
    await stopPreview();
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    try {
      await stopPreview();
    } finally {
      process.exitCode = 128 + (signal === "SIGINT" ? 2 : 15);
    }
  });
}

try {
  await run();
} catch (error) {
  console.error(`Production preview verification failed: ${error.message}`);
  if (output.trim()) {
    console.error(`Preview output:\n${output.trim()}`);
  }
  process.exitCode = 1;
}
