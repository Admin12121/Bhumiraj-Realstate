import { config } from "dotenv";
import { loadServerEnv } from "@real-estate/config";

config({ path: [".env", "../../.env"], quiet: true });

/** Validated once before any worker provider is instantiated. */
export const workerEnv = loadServerEnv();
