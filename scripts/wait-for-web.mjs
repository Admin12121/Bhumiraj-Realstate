#!/usr/bin/env node
/**
 * Waits for the dev server to answer after `docker compose restart web`.
 *
 * Turbopack's file watcher cannot watch the Windows bind mount (the web logs
 * are full of `watch error ... I/O error (os error 5)`), so edits to existing
 * files are not hot-reloaded and the container has to be restarted to pick
 * them up. Without this wait the shell returns while Next is still compiling,
 * and the first browser hit looks like the change did not land.
 */

const url = process.env["DEV_URL"] ?? "http://localhost/";
const timeoutMs = Number(process.env["DEV_WAIT_TIMEOUT_MS"] ?? 180_000);
const startedAt = Date.now();

process.stdout.write("waiting for web");

while (Date.now() - startedAt < timeoutMs) {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    // Anything that is not the "upstream booting" holding page means Next is
    // serving again; a redirect is a perfectly good answer.
    if (response.status !== 503) {
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      process.stdout.write(`\nweb is ready after ${seconds}s\n`);
      process.exit(0);
    }
  } catch {
    // Server not up yet; keep polling.
  }
  process.stdout.write(".");
  await new Promise((resolve) => setTimeout(resolve, 1_000));
}

process.stdout.write(`\nweb did not answer within ${timeoutMs}ms\n`);
process.stdout.write("check: docker compose logs --tail=100 web\n");
process.exit(1);
