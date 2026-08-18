import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

const packageDirectory = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(packageDirectory, "../../.env"), quiet: true });
config({ path: resolve(packageDirectory, "../../.env.example"), quiet: true });

const datasourceUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!datasourceUrl) {
  throw new Error("DIRECT_URL or DATABASE_URL must be set for Prisma");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: {
    url: datasourceUrl,
    // Prisma needs a scratch database to replay migrations when diffing a
    // migrations directory. Local/CI only; never a real environment.
    shadowDatabaseUrl:
      process.env.SHADOW_DATABASE_URL ??
      datasourceUrl.replace(/\/([^/?]+)(\?|$)/, "/estate_shadow$2"),
  },
});
