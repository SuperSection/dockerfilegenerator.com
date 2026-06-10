/**
 * Mongo Express — web-based MongoDB admin UI.
 */
import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "mongo-express",
  label: "Mongo Express",
  description: "Web-based MongoDB admin UI.",
  emoji: "🗂️",
  category: "ci-dev",
  tags: ["mongo", "admin", "dev", "ui"],
  image: "mongo-express",
  official: true,
  recommended: "1.0.2",
  latest: "1.0.2",
  versionSource: "sync",
  compose: {
    ports: [{ host: 8081, container: 8081 }],
    volumes: [],
    env: [
      { key: "ME_CONFIG_MONGODB_SERVER", value: "mongo" },
      { key: "ME_CONFIG_BASICAUTH_USERNAME", value: "admin" },
      { key: "ME_CONFIG_BASICAUTH_PASSWORD", value: "changeme" },
    ],
    hasHealthcheck: false,
    defaultRestart: "unless-stopped",
  },
};
