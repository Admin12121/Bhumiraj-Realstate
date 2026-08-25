#!/usr/bin/env node
/**
 * Re-registers every route with Turbopack after a web restart.
 *
 * On the Windows bind mount Turbopack's startup scan misses nested route
 * directories: `/dashboard/listings` serves while `/dashboard/listings/[slug]`
 * returns 404, with `watch error (...NotFound)` in the web logs. Clearing
 * `.next/dev` does not help and touching from inside the container does not
 * either — only a write from the host side raises an event the watcher sees.
 *
 * Rewriting each page file with its own contents is that write. It changes
 * nothing on disk and costs one rebuild.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../apps/web/app", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1",
);

function pageFiles(directory) {
  const found = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      found.push(...pageFiles(path));
    } else if (entry === "page.tsx" || entry === "layout.tsx") {
      found.push(path);
    }
  }
  return found;
}

const files = pageFiles(ROOT);
for (const file of files) {
  writeFileSync(file, readFileSync(file));
}
console.log(`re-registered ${files.length} route files`);
