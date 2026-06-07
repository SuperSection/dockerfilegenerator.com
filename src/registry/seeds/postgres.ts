/**
 * PostgreSQL — seed.
 * Identity + compose defaults. Versions are refreshed by the sync script.
 */
import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "postgres",
  label: "PostgreSQL",
  description: "The world's most advanced open source relational database.",
  emoji: "🐘",
  category: "database",
  tags: ["sql", "relational", "acid"],
  image: "postgres",
  official: true,
  recommended: "17-alpine",
  latest: "17-alpine",
  versionSource: "sync",
  compose: {
    ports: [{ host: 5432, container: 5432 }],
    volumes: [{ host: "postgres_data", container: "/var/lib/postgresql/data" }],
    env: [
      { key: "POSTGRES_USER", value: "postgres" },
      { key: "POSTGRES_PASSWORD", value: "changeme" },
      { key: "POSTGRES_DB", value: "app" },
    ],
    hasHealthcheck: true,
    healthcheckCmd: ["pg_isready", "-U", "postgres"],
    defaultRestart: "unless-stopped",
    createsVolumes: ["postgres_data"],
  },
};
