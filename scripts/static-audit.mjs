import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative, extname, basename } from "node:path";
import process from "node:process";

const root = process.cwd();
const releaseMode = process.argv.includes("--release");
const errors = [];
const warnings = [];
const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".turbo",
  "node_modules",
  "dist",
  "coverage",
  "playwright-report",
  "test-results",
  "generated",
  // Reference projects checked out inside the tree for design/logic comparison.
  // They ship their own stacks and must not be audited as our source.
  "CodeSandbox",
  "aera-stays-ui",
  "agency",
  "room24",
  ".bun-cache",
  ".codex-tmp",
]);

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) continue;
    const full = join(directory, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const allFiles = walk(root);
const sourceFiles = allFiles.filter((file) =>
  [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(extname(file)),
);
const packageFiles = allFiles.filter((file) => basename(file) === "package.json");
const relativePath = (file) => relative(root, file).replaceAll("\\", "/");
let trackedFiles = null;
try {
  trackedFiles = new Set(
    execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
      .split("\0")
      .filter(Boolean)
      .map((file) => file.replaceAll("\\", "/")),
  );
} catch {
  // Source archives may not contain Git metadata. In that case every file in
  // the archive is treated as distributed.
}

for (const file of packageFiles) {
  const rel = relativePath(file);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`${rel}: invalid JSON (${error.message})`);
    continue;
  }

  for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      if (version === "latest" || version === "next" || version === "*") {
        errors.push(`${rel}: ${section}.${name} uses an unbounded version (${version})`);
      }
      if (["axios", "elysia", "drizzle-orm", "@nestjs/swagger", "orval"].includes(name)) {
        errors.push(`${rel}: forbidden dependency ${name}`);
      }
    }
  }
}

for (const file of sourceFiles) {
  const rel = relativePath(file);
  if (rel === "scripts/static-audit.mjs") continue;
  const text = readFileSync(file, "utf8");
  const checks = [
    [/\$queryRawUnsafe\s*\(/, "unsafe Prisma raw query"],
    [/\$executeRawUnsafe\s*\(/, "unsafe Prisma raw execution"],
    [/\bas\s+any\b/, "unsafe 'as any' cast"],
    [/@ts-ignore|@ts-nocheck/, "TypeScript suppression"],
    [/\bTODO\b|\bFIXME\b/, "unfinished TODO/FIXME marker"],
    [/cors\s*:\s*\{[^}]*origin\s*:\s*["']\*["']/s, "wildcard credential-sensitive CORS"],
  ];
  for (const [pattern, label] of checks) {
    if (pattern.test(text)) errors.push(`${rel}: ${label}`);
  }

  if (rel.startsWith("apps/web/") && /@real-estate\/database|@prisma\/client/.test(text)) {
    errors.push(`${rel}: browser/web layer imports the database package`);
  }
}

for (const file of allFiles) {
  const rel = relativePath(file);
  const name = basename(file);
  if (
    name.startsWith(".env") &&
    name !== ".env.example" &&
    (!trackedFiles || trackedFiles.has(rel))
  ) {
    errors.push(`${rel}: environment secret file must not be distributed`);
  }
}

const nextConfigPath = join(root, "apps/web/next.config.ts");
if (existsSync(nextConfigPath)) {
  const nextConfig = readFileSync(nextConfigPath, "utf8");
  if (/hostname\s*:\s*["']\*\*/.test(nextConfig)) {
    errors.push("apps/web/next.config.ts: wildcard remote image hostname");
  }
  if (!/Content-Security-Policy/.test(nextConfig)) {
    warnings.push("apps/web/next.config.ts: no application CSP was detected");
  }
}

const lockPath = join(root, "bun.lock");
if (!existsSync(lockPath)) {
  const message = "bun.lock is missing; dependency resolution is not reproducible until Bun install is run";
  if (releaseMode) errors.push(message);
  else warnings.push(message);
}

if (warnings.length) {
  console.warn("Static audit warnings:");
  for (const warning of warnings) console.warn(`  - ${warning}`);
}
if (errors.length) {
  console.error("Static audit failed:");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`Static audit passed (${sourceFiles.length} source files, ${packageFiles.length} manifests).`);
