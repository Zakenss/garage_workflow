/**
 * Frees local dev ports before starting Next.js.
 * Prevents 3000 → 3001 → 3002 cascades from orphaned `next dev` processes.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PROJECT_SLUG = path.basename(PROJECT_ROOT);
const PORTS = [3000, 3001, 3002, 3003, 3004];

function killProjectDevProcessesWin() {
  try {
    const script =
      "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | " +
      `Where-Object { $_.CommandLine -match '${PROJECT_SLUG}' -and $_.CommandLine -match 'next' } | ` +
      "ForEach-Object { $_.ProcessId }";
    const out = execSync(`powershell -NoProfile -Command "${script}"`, { encoding: "utf8" });
    for (const line of out.split(/\r?\n/)) {
      const pid = Number.parseInt(line.trim(), 10);
      if (!Number.isFinite(pid) || pid <= 0) continue;
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
        console.log(`[dev] stopped previous Next.js process (PID ${pid})`);
      } catch {
        // Process may have already exited.
      }
    }
  } catch {
    // No matching processes.
  }
}

function killPortWin(port) {
  let out = "";
  try {
    out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
  } catch {
    return;
  }

  const pids = new Set();
  for (const line of out.split(/\r?\n/)) {
    if (!line.includes("LISTENING")) continue;
    const parts = line.trim().split(/\s+/);
    const pid = Number.parseInt(parts[parts.length - 1], 10);
    if (Number.isFinite(pid) && pid > 0) pids.add(pid);
  }

  for (const pid of pids) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
      console.log(`[dev] freed port ${port} (PID ${pid})`);
    } catch {
      // Process may have already exited.
    }
  }
}

function killPortUnix(port) {
  try {
    execSync(`lsof -ti:${port} | xargs -r kill -9`, { stdio: "ignore", shell: true });
    console.log(`[dev] freed port ${port}`);
  } catch {
    // Nothing listening.
  }
}

if (process.platform === "win32") {
  killProjectDevProcessesWin();
}

for (const port of PORTS) {
  if (process.platform === "win32") killPortWin(port);
  else killPortUnix(port);
}

if (process.argv.includes("--clean")) {
  fs.rmSync(".next", { recursive: true, force: true });
  console.log("[dev] removed .next cache");
}
