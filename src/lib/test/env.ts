// Loads .env.local for integration tests run with `npm test` (Next does this itself at runtime).
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
