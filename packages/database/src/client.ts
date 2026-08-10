import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/client/client";

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required before the database client is initialized.`);
  return value;
}

function integerEnvironment(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

const globalForDb = globalThis as unknown as { prisma?: PrismaClient; pool?: Pool };
const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: requiredEnvironment("DATABASE_URL"),
    max: integerEnvironment("DB_POOL_MAX", 15, 1, 100),
    idleTimeoutMillis: integerEnvironment("DB_IDLE_TIMEOUT_MS", 30_000, 1_000, 300_000),
    connectionTimeoutMillis: integerEnvironment("DB_CONNECT_TIMEOUT_MS", 5_000, 500, 60_000),
    application_name: process.env.APP_NAME ?? "bhumiraj-estates",
  });

pool.on("error", (error) => {
  // A pool-level error is not tied to an active request and must not be ignored.
  console.error("Unexpected PostgreSQL pool error", error);
});

const prisma =
  globalForDb.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(pool),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
  globalForDb.prisma = prisma;
}

export { prisma, pool };
export type { PrismaClient } from "../generated/client/client";
export type { Prisma } from "../generated/client/client";
export * from "../generated/client/enums";
