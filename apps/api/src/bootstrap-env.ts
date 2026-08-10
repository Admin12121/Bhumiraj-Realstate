import { config } from "dotenv";
import { loadServerEnv } from "@real-estate/config";

config({ path: [".env", "../../.env"], quiet: true });

/** Validated once before any API provider is instantiated. */
export const apiEnv = loadServerEnv();
