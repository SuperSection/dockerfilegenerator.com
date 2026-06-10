/**
 * Adminer — database management UI for MySQL/Postgres/Mongo/Clickhouse.
 */
import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "adminer",
  label: "Adminer",
  description: "Full-featured database management UI in a single PHP file.",
  emoji: "🛢️",
  category: "ci-dev",
  tags: ["database", "admin", "dev", "ui"],
  image: "adminer",
  official: true,
  recommended: "4.8.1",
  latest: "4.8.1",
  versionSource: "sync",
  compose: {
    ports: [{ host: 8080, container: 8080 }],
    volumes: [],
    env: [
      { key: "ADMINER_DEFAULT_SERVER", value: "postgres" },
      { key: "ADMINER_DESIGN", value: "pepa-linha-dark" },
    ],
    hasHealthcheck: true,
    healthcheckCmd: ["CMD-SHELL", "wget --spider -q http://localhost:8080/ || exit 1"],
    defaultRestart: "unless-stopped",
  },
};
