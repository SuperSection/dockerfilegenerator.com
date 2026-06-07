import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "mongodb",
  label: "MongoDB",
  description: "Document-oriented NoSQL database.",
  emoji: "🍃",
  category: "database",
  tags: ["nosql", "document"],
  image: "mongo",
  official: true,
  recommended: "8",
  latest: "8",
  versionSource: "sync",
  compose: {
    ports: [{ host: 27017, container: 27017 }],
    volumes: [{ host: "mongo_data", container: "/data/db" }],
    env: [
      { key: "MONGO_INITDB_ROOT_USERNAME", value: "root" },
      { key: "MONGO_INITDB_ROOT_PASSWORD", value: "changeme" },
    ],
    hasHealthcheck: true,
    healthcheckCmd: ["mongosh", "--eval", "db.adminCommand('ping')"],
    defaultRestart: "unless-stopped",
    createsVolumes: ["mongo_data"],
  },
};
