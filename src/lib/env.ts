import "server-only";
import { parseEnv } from "@neon/env";
import config from "../../neon";

// Typed, validated against neon.ts. Only what the app reads at runtime is required:
// the pooled Postgres URL and the branch's S3 credentials for the assets bucket.
export const env = parseEnv(config, [
  "DATABASE_URL",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_ENDPOINT_URL_S3",
  "AWS_REGION",
]);
