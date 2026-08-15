import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const packagesDir = join(root, "packages");
const tscCommand = process.platform === "win32"
  ? join(root, "node_modules", ".bin", "tsc.cmd")
  : join(root, "node_modules", ".bin", "tsc");

const packageNames = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((dirName) => {
    const packageJsonPath = join(packagesDir, dirName, "package.json");
    const tsconfigPath = join(packagesDir, dirName, "tsconfig.json");
    try {
      const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      return existsSync(tsconfigPath) && typeof manifest.scripts?.build === "string";
    } catch {
      return false;
    }
  });

if (packageNames.length === 0) {
  console.error("No buildable packages found.");
  process.exit(1);
}

let shuttingDown = false;

const children = packageNames.map((packageName) => {
  const child = spawn(
    tscCommand,
    ["-p", join("packages", packageName, "tsconfig.json"), "--watch", "--preserveWatchOutput"],
    {
      cwd: root,
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const prefix = `[packages/${packageName}]`;
  child.stdout.on("data", (chunk) => process.stdout.write(`${prefix} ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`${prefix} ${chunk}`));
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`${prefix} watcher exited (${signal ?? code}).`);
    shutdown(1);
  });

  return child;
});

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 300).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(`Watching ${packageNames.length} packages for TypeScript changes.`);
