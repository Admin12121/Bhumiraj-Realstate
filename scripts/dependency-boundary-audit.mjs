import { builtinModules } from "node:module";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import process from "node:process";

const root = process.cwd();
const packageRoots = ["apps", "packages"]
  .flatMap((parent) =>
    existsSync(join(root, parent))
      ? readdirSync(join(root, parent)).map((name) => join(root, parent, name))
      : [],
  )
  .filter((directory) => existsSync(join(directory, "package.json")));
const builtins = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]);
const ignored = new Set(["node_modules", ".next", "dist", "coverage", ".turbo"]);
const errors = [];

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    if (ignored.has(entry)) continue;
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) files.push(...walk(path));
    else if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(extname(path))) {
      files.push(path);
    }
  }
  return files;
}

function packageName(specifier) {
  if (specifier.startsWith("@")) return specifier.split("/").slice(0, 2).join("/");
  return specifier.split("/")[0];
}

for (const packageRoot of packageRoots) {
  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ]);

  for (const file of walk(packageRoot)) {
    const text = readFileSync(file, "utf8");
    const patterns = [
      /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
      /import\s*\(\s*["']([^"']+)["']\s*\)/g,
      /require\s*\(\s*["']([^"']+)["']\s*\)/g,
    ];
    const imports = new Set();
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) imports.add(match[1]);
    }

    for (const specifier of imports) {
      if (
        specifier.startsWith(".") ||
        specifier.startsWith("@/") ||
        specifier.startsWith("#") ||
        builtins.has(specifier) ||
        specifier.endsWith(".css")
      ) {
        continue;
      }
      const dependency = packageName(specifier);
      if (!declared.has(dependency)) {
        errors.push(
          `${relative(root, file)} imports ${dependency}, but ${relative(root, join(packageRoot, "package.json"))} does not declare it`,
        );
      }
    }
  }
}

if (errors.length) {
  console.error("Dependency boundary audit failed:");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`Dependency boundary audit passed (${packageRoots.length} workspaces).`);
