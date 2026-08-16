// MapLibre otherwise fetches its worker from unpkg.com, which the app's CSP
// blocks (`worker-src 'self' blob:`). Copy the worker that ships with the
// installed package into `public/` so it is served same-origin and stays
// pinned to whatever version is resolved.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

// The worker imports `./maplibre-gl-shared.mjs`, which resolves against the
// served path, so the sibling chunk has to sit next to it in public/.
const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

const dist = join(dirname(require.resolve("maplibre-gl/package.json")), "dist");
const publicDir = join(here, "..", "public");

mkdirSync(publicDir, { recursive: true });
for (const file of FILES) {
  copyFileSync(join(dist, file), join(publicDir, file));
}

console.log(`Copied MapLibre worker files to ${publicDir}: ${FILES.join(", ")}`);
