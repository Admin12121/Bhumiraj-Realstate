import Redis from "ioredis";
export function createRedis(url: string, mode: "cache" | "critical" = "critical") { return new Redis(url, { maxRetriesPerRequest: mode === "critical" ? null : 2, enableReadyCheck: true, lazyConnect: true, retryStrategy: (times) => Math.min(times * 200, 5000) }); }
