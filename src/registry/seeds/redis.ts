import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "redis",
  label: "Redis",
  description: "In-memory cache, message broker, and key-value store.",
  emoji: "🔴",
  category: "cache",
  tags: ["cache", "kv", "broker"],
  image: "redis",
  official: true,
  recommended: "7.4-alpine",
  latest: "7.4-alpine",
  versionSource: "sync",
  compose: {
    ports: [{ host: 6379, container: 6379 }],
    volumes: [{ host: "redis_data", container: "/data" }],
    env: [],
    hasHealthcheck: true,
    healthcheckCmd: ["redis-cli", "ping"],
    defaultRestart: "unless-stopped",
    createsVolumes: ["redis_data"],
  },
};
